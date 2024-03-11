import express from "express";
import expressSession from "express-session";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", express.static("styles"));
app.use(expressSession({
  secret: 'hi123',
  resave: false,
  saveUninitialized: false
}))

let balance = 5000;
let transactions = [];

function getUsers() {
  const usersData = fs.readFileSync('./database/users.json');
  const usersJsonString = usersData.toString('utf-8');
  const users = JSON.parse(usersJsonString).users; 
  return users;
}


app.get("/balance", (req, res) => {
  res.json({balance})
})

app.post("/balance", (req ,res) => {
  const {balance, receipient, description, amount, date} = req.body
  console.log(req.body)
  res.render("create_transaction")
})


app.get("/", (req, res) => {
  res.render("home")
})

app.get("/home", (req, res) => {
  if (!req.session.loggedIn) {
    res.render("login", {errorMessage : ''});
  } else {
    res.render("create_transaction", { balance, transactions, currentUser: req.session.username });
  }
})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});

app.post("/login/user", (req, res) => {
  const { username, password } = req.body;
  console.log(req.body)
  const users = getUsers();

  let errorMessage = ''; 

  const user = users.find(user => user.username === username && user.password === password);

  if (!user) {
    errorMessage = "Invalid username or password. Please try again."; 
    res.render("login", { errorMessage });
  } else {
    req.session.loggedIn = true;
    req.session.username = username;
    res.render("create_transaction")
  }
})

app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});

