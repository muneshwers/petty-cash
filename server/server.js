import express from "express";
import "dotenv/config"
import expressSession from "express-session";
import bodyParser from "body-parser";
import multer from "multer";
import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"
import serviceAccount from "../serviceAccountKey.json" assert {type : "json"}
import { 
  sendApprovalMadeEmailWithTimeout, 
  sendNearingLimitEmailWithTimout,
  sendTransactionForApprovalEmailWithTimeout,
  sendReimbursementsMadeWithTimeout,
  sendTransactionDeletedEmail
} from "./email.js";
import config from "../config.js"
import mime from "mime-types"

const app = express();
const PORT = process.env.PORT || 3000;

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "projectservers.appspot.com",
});

const upload = multer({
  dest: 'tmp/uploads/',
  fileFilter: (req, file, cb) => {
    const mimeType = mime.lookup(file.originalname);
    if (!mimeType) {
      cb(new Error('Invalid file type'));
    } else {
      cb(null, true);
    }
  }
});

const firestore = getFirestore(firebaseApp)
const storage = getStorage(firebaseApp)

const checkLoggedIn = (req, res, next) => {
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
  secret: 'secret',
  resave: false,
  saveUninitialized: false
}))
app.use(checkLoggedIn)

//Gets users from json file
app.get("/", (req, res) => {
  res.render("head")
})

app.get("/home", (req, res) => {
  let {role, account} = req.session
  res.render("home", {role, account})
})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});


app.post("/login/user", async (req, res) => {
  const { username, password } = req.body;
  const user = await getUsers(username);

  let errorMessage = ''; 

  if (!user) {
    errorMessage = "Invalid username or password. Please try again."; 
    res.render("login", { errorMessage });
    return
  } 
  if (user.password !== password) {
    errorMessage = "Incorrect Password"; 
    res.render("login", { errorMessage });
    return
  }

  let {role} = user
  role = role ?? 'basic'

  req.session.loggedIn = true;
  req.session.username = username;
  req.session.account = 'muneshwers';
  req.session.role = role
  req.session.saved = {}
  res.render("home", {role, account : req.session.account})
  return
  
})

app.get("/approve", (req, res) => {
  res.render("approve")
})

app.get("/balance", async (req, res) => {
  let balance = await getCurrentBalance(req.session.account)
  res.json({balance})
})

app.get("/transactions", async (req, res) => {
  let transactions = await getTransactions(req.session.account)
  res.json({transactions})
})

app.get("/transaction/query/:id", async (req, res) => {
  let id = Number(req.params.id)
  let {account} = req.session
  let docs = (await queryTransaction(account, id)).docs
  let transactions = []
  for (let doc of docs) {
    transactions.push(doc.data())
  }
  res.json({transactions})
})

app.get("/transactionId", async (req, res) => {
  let transactionId = await getCurrentTransactionId(req.session.account)
  res.json({transactionId})
})

app.get("/transactionHistory", async (req, res) => {
  let {account} = req.session
  let transactionHistory = await getTransactionsHistory(account)
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

app.get("/saved", (req, res) => {
  let {account, saved} = req.session
  let savedOnAccount = saved[account] ?? []
  res.json({savedOnAccount})
})

app.post("/transaction", async (req ,res) => {
  /** @type {Transaction} */
  let { transactionId, recipient, supplier, description, amount, date} = req.body
  transactionId = Number(transactionId)
  amount = Number(amount)
  let {account} = req.session
  /** @type {Transaction} */
  let transaction = {
    transactionId,
    account,
    recipient,
    supplier,
    description,
    amount,
    date,
    createdBy : req.session.username,
    editable : true,
    deleteable : true,
  }
  let currentId = await getCurrentTransactionId(account) 
  currentId = Number(currentId)
  if (currentId > transactionId) {
    transactionId = currentId
    transaction.transactionId = transactionId
  }
  if (amount < transactionApprovalLimit) {
    transaction['approved'] = true
    transaction['approvedBy'] = 'System'
    applyTimeStamp([transaction], 'approvedTime')
  }
  if (amount >= transactionApprovalLimit) {
    sendTransactionForApprovalEmailWithTimeout(account)
  }
  applyTimeStamp([transaction], "timeStamp")
  setTransactions([transaction], account);
  
  let balance = await getCurrentBalance(account)
  balance = balance - amount
  if (balance <= 100000) {
    sendNearingLimitEmailWithTimout(account)
  }
  updateBalance(balance, account)

  transactionId = Number(transactionId) + 1
  updateTransactionId(transactionId, account)
  .then(() => {
    res.render("create_transaction")
  })

  
  
})

app.post("/transaction/edit", async (req, res) => {
  /** @type {Transaction} */
  let { transactionId, recipient, supplier, description, amount, date } = req.body
  transactionId = Number(transactionId)
  let amountChanged = (amount) ? true : false
  amount = Number(amount)
  let transaction = {
    transactionId,
    recipient,
    supplier,
    description,
    amount,
    date,
  };

  let originalTransaction = await getTransaction(
    transactionId.toString(), 
    req.session.account
  )

  if (!originalTransaction) {
    res.status(404).send("Transaction not found");
    return;
  }

  applyTimeStamp([originalTransaction], "editTime")
  originalTransaction.editedBy = req.session.username
  addToTransactionHistory([{...originalTransaction}], req.session.account)
  if (!amountChanged) {
    transaction.amount = originalTransaction.amount
  }
  if (amountChanged) {
    let balance = await getCurrentBalance(req.session.account)
    balance += (originalTransaction.amount - transaction.amount)
    updateBalance(balance, req.session.account)

    if (amount < transactionApprovalLimit) {
      transaction["approved"] = true
      transaction["approvedBy"] = 'System'
      applyTimeStamp([transaction], "approvedTime")
    }
    if (amount >= transactionApprovalLimit) {
      transaction["approved"] = false
      transaction["approvedBy"] = ''
      transaction["approvedTime"] = ''
      sendTransactionForApprovalEmailWithTimeout(req.session.account)
    }

  }
  applyTimeStamp([originalTransaction], "timeStamp")
  Object.assign(originalTransaction, transaction)
  Promise.all(setTransactions([originalTransaction], req.session.account))
  .then(()=> res.render("reimburse"))
})

app.post("/transaction/delete", (req, res) => {
  /** @type {{transaction: Transaction, reason : string}} */
  let {transaction, reason} = req.body
  transaction = JSON.parse(transaction)
  /** @type {{account:string, role:string}} */
  let {account, role} = req.session

  applyTimeStamp([transaction], "deletedTime")
  applyTimeStamp([transaction], "timeStamp")
  transaction.deletedBy = req.session.username
  transaction.deleteReason = reason

  deleteTransaction(transaction, account)
  .then(() => {
    if (role == 'basic') {
      res.render("reimburse")
      return
    }
    if (role == 'approver') {
      res.render("approve")
      return
    }
  })

  addToTransactionHistory([transaction], account)
  .then(() => sendTransactionDeletedEmail(account))

  getCurrentBalance(account)
  .then((balance) => balance + transaction.amount)
  .then((newBalance) => updateBalance(newBalance, account))

})


app.post("/transaction/reimburse", async (req,res)=>{

  /** @type {{reimbursedTotal:number, toBeReimbursed: Array<Transaction>}} */
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)

  let {account} = req.session

  let balance = await getCurrentBalance(account)
  balance = Number(balance) + Number(reimbursedTotal)
  updateBalance(balance, account)

  applyTimeStamp(toBeReimbursed, "reimbursedTime")
  applyTimeStamp(toBeReimbursed, "timeStamp")
  for (let transaction of toBeReimbursed) {
    transaction['reimbursedBy'] = req.session.username;
  }
  addToTransactionHistory(toBeReimbursed, account)
  req.session.saved[account] = []

  Promise.all(deleteTransactions(toBeReimbursed, account))
  .then(() => res.render("reimburse"))
  .then(() => sendReimbursementsMadeWithTimeout(account))
  .then(() => sendReimbursementsToAdaptorServer(toBeReimbursed))
})



app.post("/account", (req, res) => {
  const {account} = req.body;
  req.session.account = account
  if (req.session.role === 'approver'){
    res.render("approve")
    return
  }
  if (req.session.role === 'basic'){
    res.render("create_transaction")
    return
  }
})

app.post("/saved", (req, res) => {
  let {account} = req.session
  let {toSave} = req.body
  req.session.saved[account] = toSave
  res.sendStatus(200)
})

app.post("/approve", (req, res) => {
  /**@type {number} */
  let transactionId = req.body.transactionId
  /** @type {string} */
  let {account} = req.session
  let transactionUpdate = {
    transactionId,
    approved: true, 
    approvedBy: req.session.username,
    editable: false,
  }
  applyTimeStamp([transactionUpdate], "approvedTime")
  updateTransaction(transactionUpdate, account)
  .then(() => res.sendStatus(200))
  .then(() => sendApprovalMadeEmailWithTimeout(account))
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {

    if (!req.file) return res.status(400).send('No files were uploaded.');
    const file = req.file;
    let filename = file.originalname
  
    /** @type {{account: string}} */
    let {account} = req.session

    /** @type {string} */
    let transactionId  = req.body.transactionId

    if (!transactionId) return res.status(400).send('transaction id is missing.')
    filename = account+"_"+transactionId+"_"+filename
    let imageUrl = await uploadImageToStorage(file, filename)

    updateTransaction({transactionId, imageUrl, filename}, account)
    .then(() => res.sendStatus(200))
  } catch (error) {
    console.error('Upload failed:', error);
    return res.status(500).send('Upload failed. Please try again.');
  }
});

app.post('/upload/delete', (req, res) => {
  /** @type {{filename: string}} */
  let {filename} = req.body
  if (!filename) return
  try{
    deleteImageFromStorage(filename)
    .then(() => res.sendStatus(200))
  }catch {
    res.sendStatus(500)
  }
})


app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});

const transactionApprovalLimit = 10000
const {database} = config

/**
 * 
 * @param {string} user 
 * @returns 
 */
async function getUsers(user) {
  return (await firestore
    .collection(database)
    .doc('Users')
    .collection('users')
    .doc(user)
    .get()).data()
}
/**
 * 
 * @param {string} account 
 * @returns {Promise<number>}
 */
async function getCurrentBalance(account) {
  const {balance} = (await firestore
  .collection(database)
  .doc(account)
  .get()).data()
  return balance;

}

/**
 * 
 * @param {string} account
 * @returns 
 */
async function getCurrentTransactionId(account) {
  let {transactionId} = (await (firestore
  .collection(database)
  .doc(account)
  .get())).data()
  return transactionId

}

/**
 * 
 * @param {string} account 
 * @returns {Promise<Array<Transaction>>}
 */
async function getTransactions(account) {
  try {
    const snapshots = (await firestore
    .collection(database)
    .doc(account)
    .collection('Transactions')
    .get())
    /**
     * @type {Array<Transaction>}
     */
    let transactions = []
    snapshots.forEach((doc) => {
      transactions.push(doc.data())
    })
    return transactions
  } catch (error) {
    console.error("Error reading current transactions:", error);
    return []
  }
}

/**
 * 
 * @param {string} transactionId 
 * @param {string} account 
 * @returns {Promise<Transaction>}
 */
async function getTransaction(transactionId, account) {
  return (await firestore
    .collection(database)
    .doc(account)
    .collection('Transactions')
    .doc(transactionId)
    .get()
    ).data()
}

async function updateBalance(balance, account) {
  return firestore
  .collection(database)
  .doc(account)
  .update({balance})
}

/**
 * 
 * @param {Array<Transaction>} transactions 
 * @param {string} account 
 * @returns {Array<Promise>}
 */
function setTransactions(transactions, account) {
  return transactions.map(
    (transaction) => firestore
    .collection(database)
    .doc(account)
    .collection('Transactions')
    .doc(transaction.transactionId.toString())
    .set(transaction)
  )
}

/**
 * @param {Transaction} transaction
 * @param {string} account
 * @returns {Promise}
 */
function updateTransaction(transaction, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Transactions')
  .doc(transaction.transactionId.toString())
  .update(transaction)
}

/**
 *    
 * @param {Array<Transaction>} transactions 
 * @param {string} account 
 * @returns {Array<Promise>}
 */
function deleteTransactions(transactions, account) {
  return transactions.map(
    (transaction) => firestore
      .collection(database)
      .doc(account)
      .collection('Transactions')
      .doc(transaction.transactionId.toString())
      .delete()
  )
}

/**
 * 
 * @param {Transaction} transaction 
 * @param {string} account 
 * @returns {Promise}
 */
function deleteTransaction(transaction, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Transactions')
  .doc(transaction.transactionId.toString())
  .delete()
}


async function updateTransactionId(transactionId, account) {
  return firestore
  .collection(database)
  .doc(account)
  .update({transactionId})
}

/**
 * 
 * @param {Array<Transaction>} transactions 
 * @param {string} account
 * @returns {Array<Promise>}
 */
async function addToTransactionHistory(transactions, account) {
  return transactions.map(transaction => firestore
    .collection(database)
    .doc(account)
    .collection('History')
    .add(transaction)
  )
}

/**
 * 
 * @param {Array<Transaction>} transactions 
 * @param {string} purpose 
 */
function applyTimeStamp(transactions, purpose) {
  const date = new Date();
  const options = { timeZone: 'America/Guyana',  timeZoneName: 'short' };
  const formattedDate = date.toLocaleString('en-US', options);
  for (let transaction of transactions) {
    transaction[purpose] = formattedDate
  }
}


async function getTransactionsHistory(account) {
  try {
    const snapshots = (await firestore
    .collection(database)
    .doc(account)
    .collection('History')
    .orderBy("transactionId", 'desc')
    .get())
    /** @type {Array<Transaction>}*/
    let transactions = []
    snapshots.forEach((doc) => {
      transactions.push(doc.data())
    })
    return transactions
  } catch (error) {
    console.error("Error reading transaction history:", error);
    return []
  }
}

/**
 * 
 * @param {Array<Transaction>} reimbursements 
 */
function sendReimbursementsToAdaptorServer(reimbursements) {
  let {adaptorServerUrl} = config
  fetch(adaptorServerUrl, {
      method : "POST",
      headers : {
          "Content-Type" : "application/json"
      },
      body : JSON.stringify({reimbursements})
  }).then(
      (response) => console.log(response)
  )
}

/**
 * 
 * @param {string} account 
 * @param {number} transactionId 
 */
async function queryTransaction(account, transactionId) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('History')
  .where('transactionId', "==", transactionId)
  .orderBy("timeStamp")
  .get()
}

/**
 * 
 * @param {Express.Multer.File} file 
 * @param {string} filename 
 * @returns {Promise<string>}
 */
async function uploadImageToStorage(file, filename) {
  const uploadResponse = await storage.bucket().upload(file.path, {destination: filename})
  const url = (await uploadResponse[0].getSignedUrl({action: 'read', expires : "01-01-3000"}))[0]
  return url

}

/**
 *
 * @param {string} path 
 * @return {Promise}
 */
async function deleteImageFromStorage(path) {
  const file = storage.bucket().file(path)
  if (!file) {
    throw Error("image not found")
  }
  return file.delete()
}

/**
 * Represents a transaction.
 * @typedef {Object} Transaction
 * @property {number} transactionId - The ID of the transaction.
 * @property {number} amount - The amount of the transaction.
 * @property {string} account - The account that the transaction is from
 * @property {string} recipient - The recipient of the transaction.
 * @property {string} supplier - The supplier involved in the transaction.
 * @property {string} description - The description of the transaction.
 * @property {boolean?} approved - Indicates if the transaction is approved.
 * @property {string?} approvedBy - The user that approved the transaction
 * @property {string?} approvedTime - The time that the user approved the transaction
 * @property {string} createdBy - The user who created the transaction.
 * @property {string} date - The date that the user created the transaction.
 * @property {string} timeStamp - The time that transaction was created/edited/deleted/reimbursed
 * @property {boolean?} editable - if the transaction can be edited
 * @property {string?} editTime - the time that the transaction was edited
 * @property {string?} editedBy - the user who edited the transaction.
 * @property {string?} reimbursedBy - the user who reimbursed the transaction.
 * @property {string?} reimbursedTime - the time that the transaction was reimbursed
 * @property {boolean?} deleteable  - if the transaction is deleteable
 * @property {string?} deletedTime - the time a user deleted the transaction
 * @property {string?} deletedBy - the user that deleted the transaction
 * @property {string?} deleteReason - the reason the user deleted the transaction
 * @property {string?} filename - the file name for the receipt image in storage
 * @property {string?} imageUrl - the image url for the transaction receipt
 */