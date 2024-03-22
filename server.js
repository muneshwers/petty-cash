import express from "express";
import expressSession from "express-session";
import bodyParser from "body-parser";
import admin from "firebase-admin"
import serviceAccount from "./serviceAccountKey.json" assert {type : "json"}

const app = express();
const PORT = process.env.PORT || 3000;

admin.initializeApp({
  credential : admin.credential.cert(serviceAccount)
})

const checkLoggedIn = (req, res, next) => {
  console.log(req.url)
  const unprotectedUrl = [
    "/",
    "/login",
    "/login/user",
    "/styles/style.css"
  ]
  if (unprotectedUrl.includes(req.url)){
    next()
    return
  }
  console.log(req.session)
  if (!req.session?.loggedIn) {
    res.redirect("/login")
    return
  }
  next()
  return
}

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", express.static("styles"));
app.use("/static", express.static("static"));
app.use(expressSession({
  secret: 'hi123',
  resave: false,
  saveUninitialized: false
}))
app.use(checkLoggedIn)

//Gets users from json file
app.get("/", (req, res) => {
  res.render("head")
})

app.get("/home", (req, res) => {
  res.render("home")
})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});


app.post("/login/user", async (req, res) => {
  const { username, password } = req.body;
  const users = await getUsers();

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
  console.log(req.session)
  res.render("home")
  return
  
})

//Sends current balance to homepage
app.get("/balance", async (req, res) => {
  let balance = await getCurrentBalance(req.session)
  res.json({balance})
})

app.get("/transactions", async (req, res) => {
  let transactions = await getTransactionsFile(req.session)
  res.json({transactions})
})

app.get("/transactionId", async (req, res) => {
  let {account} = req.session
  let transactionId = await getCurrentTransactionId(req.session) 
  res.json({transactionId})
})

//Receives form input and updates balance current value
app.post("/balance", async (req ,res) => {
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
  let currentId = await getCurrentTransactionId(req.session) 
  currentId = Number(currentId)
  if (currentId > transactionId) {
    transactionId = currentId
    transaction.transactionId = transactionId
  }
  let transactions = await getTransactionsFile(req.session)
  transactions.push(transaction)
  updateTransactionsFile(transactions, account);
  let balance = await getCurrentBalance(req.session)
  balance = balance - amount
  updateBalance(balance, account).then(_ => {
    transactionId = Number(transactionId) + 1
    updateTransactionId(transactionId, account).then(_ => {
      res.render("create_transaction")
    })

  })

})

app.post("/editBalance", async (req, res) => {
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

  let transactions = await getTransactionsFile(req.session)

  let originalTransaction = transactions.find(
    existingTransaction => existingTransaction.transactionId == transactionId
  );

  if (!originalTransaction) {
    res.status(404).send("Transaction not found");
    return;
  }

  updateTransactionHistory([{...originalTransaction}], req.session.account)

  if (amount == null || amount == '') {
    transaction.amount = originalTransaction.amount
  }
  else {
    let balance = await getCurrentBalance(req.session)
    balance += (originalTransaction.amount - transaction.amount)
    updateBalance(balance, req.session.account)
  }
  Object.assign(originalTransaction, transaction)
  updateTransactionsFile(transactions, req.session.account).then(_ => {
    res.render("reimburse")
    return
  })
})



//Takes reimbursed total from table and adds to current balance
app.post("/reimburseBalance", async (req,res)=>{
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)
  let balance = await getCurrentBalance(req.session)
  balance = Number(balance) + Number(reimbursedTotal)
  let {account} = req.session
  updateBalance(balance, account)
  let transactions = await getTransactionsFile(req.session)
  for (let reimbursement of toBeReimbursed) {
    deleteFromCurrentTransactions(transactions, reimbursement)
  }
  updateTransactionsFile(transactions, account).then(_ => {
    updateTransactionHistory(toBeReimbursed, account)
    req.session.saved[account] = []
    res.render("reimburse")
  })
})

app.get("/transactionHistory", async (req, res) => {
  let {account} = req.session
  let transactionHistory = await getTransactionHistory(account)
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
  const userRef = admin.firestore().collection('Database').doc('Users')
});


async function getUsers() {
  const {Users} = (await admin.firestore().collection('Database').doc('Users').get()).data()
  return Users
}

async function getCurrentBalance(session) {
  let {account} = session
  try {
    const {balance} = (await admin.firestore().collection('Database').doc(account).get()).data()
    console.log(balance)
    return balance;
  } catch (error) {
    console.error("Error reading current balance:", error);
    return -1;
  }
}

async function getCurrentTransactionId(session) {
  let {account} = session
  let {transactionId} = (await (admin.firestore().collection('Database').doc(account).get())).data()
  console.log(transactionId)
  return transactionId

}


async function getTransactionsFile(session) {
  let {account} = session
  try {
    const {transactions} = (await admin.firestore()
    .collection('Database')
    .doc(account)
    .collection('Transactions')
    .doc('transactions')
    .get()).data()
    console.log({transactions})
    return transactions
  } catch (error) {
    console.error("Error reading current transactions:", error);
    return []
  }
}

async function updateBalance(balance, account) {
  return admin.firestore().collection('Database').doc(account).update({balance})
}

async function updateTransactionsFile(transactions, account) {
  return admin.firestore()
  .collection('Database')
  .doc(account)
  .collection('Transactions')
  .doc('transactions')
  .update({transactions})
}


async function updateTransactionId(transactionId, account) {
  return admin.firestore()
  .collection('Database')
  .doc(account)
  .update({transactionId})
}

/**
 * 
 * @param {Array<any>} transactions 
 */
async function updateTransactionHistory(transactions, account) {
  const transactionHistory = await getTransactionHistory(account)
  transactionHistory.push(...transactions)
  admin.firestore()
  .collection('Database')
  .doc(account)
  .collection('History')
  .doc('transactionHistory')
  .update({transactionHistory})
}

async function getTransactionHistory(account) {
  const {transactionHistory} = (await admin.firestore()
  .collection('Database')
  .doc(account)
  .collection('History')
  .doc('transactionHistory').get()).data()
  return transactionHistory
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