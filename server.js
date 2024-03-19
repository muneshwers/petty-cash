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
  req.session.balance = 0
  req.session.transactions = []
  req.session.saved = {}
  getCurrentBalance(req.session)
  getTransactionsFile(req.session)
  res.render("home")
  return
  
})

//Sends current balance to homepage
app.get("/balance", (req, res) => {
  let {balance} = req.session
  res.json({balance})
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
  req.session.transactions.push(transaction)
  let {transactions, account} = req.session
  updateTransactionsFile(transactions, account);
  req.session.balance = req.session.balance - amount
  let {balance} = req.session
  updateBalance(balance, account);
  transactionId = Number(transactionId) + 1
  fs.writeFileSync(`database/${account}/transactionId.json`, JSON.stringify({transactionId}))
  res.render("create_transaction")

})

//Takes reimbursed total from table and adds to current balance
app.post("/reimburseBalance",(req,res)=>{
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)
  req.session.balance = Number(req.session.balance) + Number(reimbursedTotal)
  let {balance, account} = req.session
  updateBalance(balance, account)
  for (let reimbursement of toBeReimbursed) {
    deleteFromCurrentTransactions(req.session, reimbursement)
  }
  updateTransactionsFile(req.session.transactions, account)
  updateTransactionHistory(toBeReimbursed, account)
  req.session.saved[account] = []
  res.render("reimburse")
})

app.get("/transactions", (req, res) => {
  let {transactions} = req.session
  res.json({transactions})
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
  getCurrentBalance(req.session)
  getTransactionsFile(req.session)
  res.render("create_transaction")
})

app.get("/saved", (req, res) => {
  console.log(req.session)
  let {account, saved} = req.session
  let savedOnAccount = saved[account] ?? []
  res.json({savedOnAccount})
})

app.post("/saved", (req, res) => {
  let {account} = req.session
  let {toSave} = req.body
  console.log(toSave)
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
    session.balance = balance
    return;
  } catch (error) {
    console.error("Error reading current balance:", error);
    session.balance = -1
    return ;
  }
}

function getTransactionsFile(session) {
  let {account} = session
  try {
    const {transactions} = JSON.parse(fs.readFileSync(`database/${account}/currentTransactions.json`, "utf-8"));
    session.transactions = transactions
    return
  } catch (error) {
    console.error("Error reading current transactions:", error);
    session.transactions = []
    return
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
 * 
 * @param {string} transactionId 
 */
function deleteFromCurrentTransactions(session, reimbursement) {
  let index = session.transactions.findIndex((transaction) => transaction.transactionId == reimbursement.transactionId)
  if (index < 0) {
    return
  } 
  session.transactions.splice(index, 1)

}
//TODO:
// Is there a way to title a table? 
// style the sheet
