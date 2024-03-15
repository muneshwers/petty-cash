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

let account = 'muneshwers'

//Gets users from json file
app.get("/", (req, res) => {
  res.render("head")
})

app.get("/home", (req, res) => {
  if (!req.session.loggedIn) {
    res.render("login", {errorMessage : ''});
  } else {
    res.render("home")
  }
})

//Sends current balance to homepage
app.get("/balance", (req, res) => {
  res.json({balance})
})

//Receives form input and updates balance current value
app.post("/balance", (req ,res) => {
  const {recipient, description, amount, date} = req.body
  let transaction = {
    transactionId:  Math.round(Math.random() * 240),
    recipient,
    description,
    amount,
    date,
    createdBy : req.session.username
  }
  transactions.push(transaction)
  updateTransactionsFile(account);
  balance = balance - amount
  updateBalance(account);
  res.render("create_transaction")

})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});

//Takes reimbursed total from table and adds to current balance
app.post("/reimburseBalance",(req,res)=>{
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)
  balance = Number(balance) + Number(reimbursedTotal)
  updateBalance(account)
  console.log({toBeReimbursed})
  for (let reimbursement of toBeReimbursed) {
    deleteFromCurrentTransactions(reimbursement)
  }
  updateTransactionsFile(account)
  updateTransactionHistory(toBeReimbursed, account)
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
    return
  } 

  req.session.loggedIn = true;
  req.session.username = username;
  res.render("home")
  return
  
})

app.get("/create_transaction", (req, res) => {
  res.render("create_transaction")
})

app.get("/reimburse", (req, res) => {
  res.render("reimburse")
})

app.get("/transactions", async (req, res) => {
  res.json({transactions})
})

app.listen(PORT, () => {
  account = 'muneshwers'
  balance  = getCurrentBalance(account)
  transactions = getTransactionsFile(account)
  console.log(`App is running on port ${PORT}`);
});


function getUsers() {
  const {users} = JSON.parse(fs.readFileSync('./database/users.json', "utf-8"))
  return users
}

function getCurrentBalance(account) {
  try {
    const {balance} = JSON.parse(fs.readFileSync(`database/${account}/currentBalance.json`, "utf-8"))
    return balance;
  } catch (error) {
    console.error("Error reading current balance:", error);
    return 0;
  }
}

function updateBalance(account) {
  fs.writeFileSync(`database/${account}/currentBalance.json`, JSON.stringify({balance}));
}

function updateTransactionsFile(account) {
  fs.writeFileSync(`database/${account}/currentTransactions.json`, JSON.stringify({transactions}));
}

function getTransactionsFile(account) {
    try {
      const {transactions} = JSON.parse(fs.readFileSync(`database/${account}/currentTransactions.json`, "utf-8"));
      return transactions;
    } catch (error) {
      console.error("Error reading current transactions:", error);
      return []
    }
}

/**
 * 
 * @param {Array<any>} transactions 
 */
function updateTransactionHistory(transactions, account) {
  const {transactionHistory} = JSON.parse(fs.readFileSync(`database/${account}/transactionHistory.json`, "utf-8"))
  transactionHistory.push(...transactions)
  fs.writeFileSync(`database/${account}/transactionHistory.json`, JSON.stringify({transactionHistory}));
}

/**
 * 
 * @param {string} transactionId 
 */
function deleteFromCurrentTransactions(reimbursement) {
  console.log({transactions})
  console.log({reimbursement})
  let index = transactions.findIndex((transaction) => transaction.transactionId == reimbursement.transactionId)
  if (index < 0) {
    return
  } 
  transactions.splice(index, 1)

}
//TODO:
// Test how including the ag grid works with htmx 
// Is there a way to title a table? 
// should I make the create transaction page completely separate
// style the sheet
