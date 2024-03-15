import express from "express";
import expressSession from "express-session";
import bodyParser from "body-parser";
import mongoose from "mongoose";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", express.static("styles"));
app.use(express.json());
app.use(expressSession({
  secret: 'hi123',
  resave: false,
  saveUninitialized: false
}));

// Connect to Petty-Cash
mongoose.connect('mongodb://localhost:27017/petty-cash', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to Petty Cash'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});
const Users = mongoose.model('User', userSchema);

// Define Transaction schema
const transactionSchema = new mongoose.Schema({
  transactionId: Number,
  recipient: String,
  description: String,
  amount: Number,
  date: Date,
  createdBy: String
});
const Transaction = mongoose.model('Transaction Log', transactionSchema);

// Define Balance schema
const balanceSchema = new mongoose.Schema({
  balance: Number
});
const Balance = mongoose.model('Balance', balanceSchema);

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/home", (req, res) => {
  if (!req.session.loggedIn) {
    res.render("login", { errorMessage: '' });
  } else {
    res.render("create_transaction");
  }
});

app.get("/balance", async (req, res) => {
  try {
    const balanceObj = await Balance.findOne();
    const balance = balanceObj.balance;
    res.json({ balance });
  } catch (error) {
    console.error("Error retrieving balance:", error);
    res.status(500).send("Internal server error");
  }
});


app.post("/balance", async (req, res) => {
  const { recipient, description, amount, date } = req.body;
  try {
    const newTransaction = new Transaction({
      transactionId: Math.round(Math.random() * 240),
      recipient,
      description,
      amount,
      date,
      createdBy: req.session.username
    });
    await newTransaction.save();

    const balanceObj = await Balance.findOne();
    balanceObj.balance -= amount;
    await balanceObj.save();

    res.render("create_transaction", { currentUser: req.session.username });
  } catch (error) {
    console.error("Error updating balance:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/login/user", async (req, res) => {
  const { username, password } = req.body;
  try {
    console.log("Attempting to find user with username:", username);
    const user = await Users.findOne({ username, password });
    console.log("User found:", user);
    if (!user) {
      res.render("login", { errorMessage: "Invalid username or password. Please try again." });
    } else {
      req.session.loggedIn = true;
      req.session.username = username;
      res.render("create_transaction");
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Internal server error");
  }
});



app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});


