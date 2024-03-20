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
app.use("/static", express.static("static"));
app.use(express.json());
app.use(expressSession({
  secret: 'hi123',
  resave: false,
  saveUninitialized: false
}));

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

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});


app.post("/login/user", (req, res) => {
  const { username, password } = req.body;
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
  req.session.account = 'muneshwers';
  req.session.saved = {}
  res.render("home")
  return
  
})

//Sends current balance to homepage
app.get("/balance", (req, res) => {
  let balance = getCurrentBalance(req.session)
  res.json({balance})
})

app.get("/transactions", (req, res) => {
  let transactions = getTransactionsFile(req.session)
  res.json({transactions})
})

app.get("/transactionId", (req, res) => {
  let {account} = req.session
  let {transactionId} = JSON.parse(fs.readFileSync(`database/${account}/transactionId.json`, "utf-8"))
  res.json({transactionId})
})

//Receives form input and updates balance current value
app.post("/balance", (req ,res) => {
  let { transactionId ,recipient, description, amount, date} = req.body
  transactionId = Number(transactionId)
  let transaction = {
    transactionId,
    recipient,
    description,
    amount,
    date,
    createdBy : req.session.username
  }
  let {account} = req.session
  let currentId = JSON.parse(fs.readFileSync(`database/${account}/transactionId.json`, "utf-8")).transactionId
  currentId = Number(currentId)
  if (currentId > transactionId) {
    transactionId = currentId
    transaction.transactionId = transactionId
  }
  let transactions = getTransactionsFile(req.session)
  transactions.push(transaction)
  updateTransactionsFile(transactions, account);
  let balance = getCurrentBalance(req.session)
  balance = balance - amount
  updateBalance(balance, account);
  transactionId = Number(transactionId) + 1
  fs.writeFileSync(`database/${account}/transactionId.json`, JSON.stringify({transactionId}))
  res.render("create_transaction")

})

app.post("/editBalance", (req, res) => {
  let { transactionId, recipient, description, amount, date } = req.body
  transactionId = Number(transactionId)
  let transaction = {
    transactionId,
    recipient,
    description,
    amount,
    date,
    createdBy: req.session.username
  };

  let transactions = getTransactionsFile(req.session)

  let originalTransaction = transactions.find(
    existingTransaction => existingTransaction.transactionId == transactionId
  );

  if (!originalTransaction) {
    res.status(404).send("Transaction not found");
    return;
  }

  updateTransactionHistory([originalTransaction], req.session.account)

  if (amount == null || amount == '') {
    transaction.amount = originalTransaction.amount
  }
  else {
    let balance = getCurrentBalance(req.session)
    balance += (originalTransaction.amount - transaction.amount)
    updateBalance(balance, req.session.account)
  }
  Object.assign(originalTransaction, transaction)
  updateTransactionsFile(transactions, req.session.account)
  res.render("reimburse")
  return
})



//Takes reimbursed total from table and adds to current balance
app.post("/reimburseBalance",(req,res)=>{
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)
  let balance = getCurrentBalance(req.session)
  balance = Number(balance) + Number(reimbursedTotal)
  let {account} = req.session
  updateBalance(balance, account)
  let transactions = getTransactionsFile(req.session)
  for (let reimbursement of toBeReimbursed) {
    deleteFromCurrentTransactions(transactions, reimbursement)
  }
  updateTransactionsFile(transactions, account)
  updateTransactionHistory(toBeReimbursed, account)
  req.session.saved[account] = []
  res.render("reimburse")
})

app.get("/transactionHistory", (req, res) => {
  const {transactionHistory} = JSON.parse(fs.readFileSync(`database/${req.session.account}/transactionHistory.json`, "utf-8"))
  res.json({transactionHistory})
})

app.get("/create_transaction", (req, res) => {
  res.render("create_transaction")
})

app.get("/reimburse", (req, res) => {
  res.render("reimburse")
})

app.get("/transaction_history", (req, res) => {
  res.render("transaction_history")
})

app.post("/account", (req, res) => {
  const {account} = req.body;
  req.session.account = account.toLowerCase()
  res.render("create_transaction")
})

app.get("/saved", (req, res) => {
  let {account, saved} = req.session
  let savedOnAccount = saved[account] ?? []
  res.json({savedOnAccount})
})

app.post("/saved", (req, res) => {
  let {account} = req.session
  let {toSave} = req.body
  req.session.saved[account] = toSave
  res.sendStatus(200)
})

app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});


function getUsers() {
  const {users} = JSON.parse(fs.readFileSync('./database/users.json', "utf-8"))
  return users
}

function getCurrentBalance(session) {
  let {account} = session
  try {
    const {balance} = JSON.parse(fs.readFileSync(`database/${account}/currentBalance.json`, "utf-8"))
    return balance;
  } catch (error) {
    console.error("Error reading current balance:", error);
    return -1;
  }
}

function getTransactionsFile(session) {
  let {account} = session
  try {
    const {transactions} = JSON.parse(fs.readFileSync(`database/${account}/currentTransactions.json`, "utf-8"));
    return transactions
  } catch (error) {
    console.error("Error reading current transactions:", error);
    return []
  }
}

function updateBalance(balance, account) {
  fs.writeFileSync(`database/${account}/currentBalance.json`, JSON.stringify({balance}));
}

function updateTransactionsFile(transactions, account) {
  fs.writeFileSync(`database/${account}/currentTransactions.json`, JSON.stringify({transactions}));
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
 * @param {Array<any>} transactions
 * @param {string} transactionId 
 */
function deleteFromCurrentTransactions(transactions, reimbursement) {
  let index = transactions.findIndex((transaction) => transaction.transactionId == reimbursement.transactionId)
  if (index < 0) {
    return
  } 
  transactions.splice(index, 1)

}
//TODO:
// Is there a way to title a table? 
// style the sheet
