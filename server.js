import express from "express";
import expressSession from "express-session";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const transactions = [];
let balance = 5000; //Initializes balance with 5000 when server starts

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

//Gets users from json file
function getUsers() {
  const usersData = fs.readFileSync('./database/users.json');
  const usersJsonString = usersData.toString('utf-8');
  const users = JSON.parse(usersJsonString).users;
  return users
}

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
  return users
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

//Sends current balance to homepage
app.get("/balance", (req, res) => {
  res.json({balance})


//Receives form input and updates balance current value
app.post("/balance", (req ,res) => {
  const {recipient, description, amount, date} = req.body
  let data = {
    recipient,
    description,
    amount,
    date,
    createdBy : req.session.username
  }
  balance = balance - amount;
  transactions.push(data);
  console.log(transactions);
  console.log("(Server Action) Balance is now $" + balance);
  console.log("(Server Action) Data Received: "+ recipient + " , " + description  + " , " + amount  + " , " + date + " , " + req.session.username);
  // console.log(req.body)
  res.render("create_transaction")
})

//Checks 
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

app.get("/reimburse", (req, res) => {
  res.render("reimburse")
})

//Receives data from form body and pushes to transactionLog array
// app.post("/transactions", async (req, res) => {
//   const data = await req.body;
//   const {recipient, description, amount, date, createdBy } = data;
//   balance = balance - amount;
//   transactionLog.push(data);
//   console.log(transactionLog);
//   console.log("(Server Action) Balance is now $" + balance);
//   console.log("(Server Action) Data Received: "+ recipient + " , " + description  + " , " + amount  + " , " + date + " , " + createdBy);
// })

//Sends the transactionLog to client
app.get("/transactions", async (req, res) => {
  res.json({transactions})
  console.log("(Server Action) Returning transactions log")
  console.log(transactions);
})

app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});

