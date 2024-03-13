import express from "express";
import expressSession from "express-session";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
// const transactions = [];
// let balance = 5000; //Initializes balance with 5000 when server starts

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

function getCurrentBalance() {
  try {
    const balanceData = fs.readFileSync('database\\currentBalance.json');
    const balanceJsonString = balanceData.toString('utf-8');
    const balance = JSON.parse(balanceJsonString);
    return balance;
  } catch (error) {
    console.error("Error reading current balance:", error);
    return 0;
  }
}

function updateBalance(amount) {
  const existingBalance = getCurrentBalance();
  existingBalance.balance = existingBalance.balance-amount;
  fs.writeFileSync('database\\currentBalance.json', JSON.stringify(existingBalance));
}

function updateBalancefromReimburse(reimburseTotal) {
  console.log("Balance is updating")
  const existingBalance = getCurrentBalance();
  existingBalance.balance = existingBalance.balance+reimburseTotal;
  fs.writeFileSync('database\\currentBalance.json', JSON.stringify(existingBalance));
}


function updateTransactionsFile(newTransaction) {
  
  const existingTransactions = JSON.parse(fs.readFileSync('database/currentTransactions.json'));
  existingTransactions.transactions.push(newTransaction);
  fs.writeFileSync('database/currentTransactions.json', JSON.stringify(existingTransactions));
}

function getTransactionsFile() {
    try {
      const transactionsData = fs.readFileSync('database/currentTransactions.json');
      const transactionsJsonString = transactionsData.toString('utf-8');
      const transactions = JSON.parse(transactionsJsonString);
      return transactions;
    } catch (error) {
      console.error("Error reading current transactions:", error);
      return 0;
    }
}

app.get("/", (req, res) => {
  res.render("home")
})

app.get("/home", (req, res) => {
  if (!req.session.loggedIn) {
    res.render("login", {errorMessage : ''});
  } else {
    res.render("create_transaction", { currentUser: req.session.username });
  }
})

//Sends current balance to homepage
app.get("/balance", (req, res) => {
  const balanceObj = getCurrentBalance();
  const balance = balanceObj.balance
  res.json({balance})
})

//Receives form input and updates balance current value
app.post("/balance", (req ,res) => {
  const {recipient, description, amount, date,reimburseTotal} = req.body
  let data = {
    recipient,
    description,
    amount,
    date,
    createdBy : req.session.username
  }
  updateBalance(amount);
  updateTransactionsFile(data);

  //Seeing balance updates on server
  const balanceObj = getCurrentBalance();
  const balance = balanceObj.balance
  const transactions = getTransactionsFile();
  console.log(transactions);
  console.log("(Server Action) Balance is now $" + balance);
  console.log("(Server Action) Data Received: "+ recipient + " , " + description  + " , " + amount  + " , " + date + " , " + req.session.username);
  // console.log(req.body)
  res.render("create_transaction")
})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});

app.post("/reimburseBalance",(req,res)=>{
  const{reimburseTotal} = req.body
  updateBalancefromReimburse(reimburseTotal)
})
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


//Sends the transactions array to reimbursed table
app.get("/transactions", async (req, res) => {
  let transactionsObj = getTransactionsFile()
  let transactions = transactionsObj.transactions;
  res.json({transactions})
  console.log("(Server Action) Returning transactions log")
  console.log(transactions);
})

app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});

