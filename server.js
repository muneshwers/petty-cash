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

/**
 * @type {number} - the current balance
 */
let balance = 0

let transactions = []

//Gets users from json file
function getUsers() {
  const usersData = fs.readFileSync('./database/users.json');
  const usersJsonString = usersData.toString('utf-8');
  const users = JSON.parse(usersJsonString).users;
  return users
}

function getCurrentBalance() {
  try {
    const {balance} = fs.readFileSync('database/currentBalance.json', "utf-8");
    return balance;
  } catch (error) {
    console.error("Error reading current balance:", error);
    return 0;
  }
}

function updateBalance() {
  fs.writeFileSync('database\\currentBalance.json', JSON.stringify({balance}));
}

function updateBalancefromReimburse(reimburseTotal) {
  console.log("Balance is updating")
  balance = balance + reimburseTotal
  updateBalance()
}


function updateTransactionsFile() {
  fs.writeFileSync('database/currentTransactions.json', JSON.stringify(existingTransactions));
}

function getTransactionsFile() {
    try {
      const {transactions} = fs.readFileSync('database/currentTransactions.json', "utf-8");
      return transactions;
    } catch (error) {
      console.error("Error reading current transactions:", error);
      return []
    }
}

function updateTransactionHistory(transaction) {
  const {transactionHistory} = fs.readFileSync('database/transactionHistory.json', "utf-8")
  transactionHistory.push(transaction);
  fs.writeFileSync('database/transactionHistory.json', JSON.stringify({transactionHistory}));
}

/**
 * 
 * @param {string} transactionId 
 */
function deleteFromCurrentTransactions(transactionId) {
  let index = transactions.findIndex((transaction) => transaction.id == transactionId)
  if (index < 0) {
    return
  } 
  transactions.splice(index, 1)

}

app.get("/", (req, res) => {
  res.render("home")
})

app.get("/home", (req, res) => {
  if (!req.session.loggedIn) {
    res.render("login", {errorMessage : ''});
  } else {
    res.render("create_transaction")
  }
})

//Sends current balance to homepage
app.get("/balance", (req, res) => {
  res.json({balance})
})

//Receives form input and updates balance current value
app.post("/balance", (req ,res) => {
  const {recipient, description, amount, date} = req.body
  console.log("(Server Action) --------------------------- Updating Balance and Current Transactions---------------------------")
  let transaction = {
    transactionId:  Math.round(Math.random() * 240),
    recipient,
    description,
    amount,
    date,
    createdBy : req.session.username
  }
  transactions.push(transaction)
  updateTransactionsFile();
  balance = balance - amount
  updateBalance();

  //Seeing balance updates on server
  console.log(transactions);
  console.log("(Server Action) Balance is now $" + balance);
  console.log("(Server Action) Data Received: "+ data.transactionId + " , " + recipient + " , " + description  + " , " + amount  + " , " + date + " , " + req.session.username);
  // console.log(req.body)
  console.log("(Server Action) ---------------------------[END] Updating Balance and Current Transactions---------------------------")
  res.render("create_transaction")

})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});

//Takes reimbursed total from table and adds to current balance
app.post("/reimburseBalance",(req,res)=>{
  const{reimbursedTotal, toBeReimbursed} = req.body
  updateBalancefromReimburse(reimbursedTotal)
  for (let reimbursement of toBeReimbursed) {
    deleteFromCurrentTransactions(reimbursement)
  }
  updateTransactionsFile()
  updateTransactionHistory(transaction)
  res.render("reimburse")
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

app.get("/create_transaction", (req, res) => {
  res.render("create_transaction")
})

app.get("/reimburse", (req, res) => {
  res.render("reimburse")
})

app.post("/test", (req, res) => {
  let {toBeReimbursed, reimbursedTotal} = req.body
  console.log(reimbursedTotal)
  res.render("reimburse")
})

//Sends the transactions array to reimbursed table
app.get("/transactions", async (req, res) => {
  res.json({transactions})
})

app.listen(PORT, () => {
  balance  = getCurrentBalance()
  transactions = getTransactionsFile()
  console.log(`App is running on port ${PORT}`);
});


//TODO:
// Test how including the ag grid works with htmx 
// Is there a way to title a table? 
// should I make the create transaction page completely separate
// style the sheet
