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

app.get("/reimbursements", async (req, res) => {
  let reimbursements = await getReimbursements(req.session.account)
  res.json({reimbursements})
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

app.get("/transactions/history", async (req, res) => {
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

app.get("/reimbursement_history", (req, res) => {
  res.render("reimbursement_history")
})

app.get("/transaction_sign", (req, res) => {
  let { role } = req.session
  let signApproval = (role == 'approver') ? true : false
  res.render("sign", {signApproval})
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

app.post("/reimbursement/sign", async (req, res) => {
  /** @type {{reimbursement : Reimbursement}} */
  let { reimbursement } = req.body
  reimbursement = JSON.parse(reimbursement)
  /** @type {{account: string }} */
  let { account } = req.session
  /** @type {Reimbursement}  */
  let reimbursementUpdate = {}
  reimbursementUpdate.reimbursementId = reimbursement.reimbursementId
  reimbursementUpdate.signed = true
  reimbursementUpdate.signedBy = req.session.username
  applyTimeStamp([reimbursementUpdate], "signedTime")
  updateReimbursement(reimbursementUpdate, account)
  .then(() => {
    res.render("sign", {signApproval : true} )
  })
  .then(() => {
    let transactions = Object.values(reimbursement.transactions)
    sendReimbursementsToAdaptorServer(transactions)
  })
})


app.post("/reimbursement/collect", async (req, res) => {
  /** @type {{reimbursement : Reimbursement}} */
  let { reimbursement } = req.body
  reimbursement = JSON.parse(reimbursement)

  /** @type {{account: string }} */
  let { account } = req.session

  /** @type {Reimbursement}  */
  let reimbursementUpdate = {}
  reimbursementUpdate.reimbursementId = reimbursement.reimbursementId
  reimbursementUpdate.collected = true
  reimbursementUpdate.collectedBy = req.session.username
  applyTimeStamp([reimbursementUpdate], "collectedTime")

  updateReimbursement(reimbursementUpdate, account).then(() => {
    res.redirect("/transaction_sign")
  })

  getCurrentBalance(account).then((balance) => {
    balance = Number(balance) + Number(reimbursement.amount)
    updateBalance(balance, account)
  })


})

app.post("/reimbursement", async (req,res)=> {
  /** @type {{reimbursedTotal:number, toBeReimbursed: Array<Transaction>}} */
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)

  /** @type {{account : string}} */
  let {account} = req.session
  Promise.all(deleteTransactions(toBeReimbursed, account))
  .then(() => res.render("reimburse"))
  .then(() => sendReimbursementsMadeWithTimeout(account))


  getCurrentReimbursementId(req.session.account).then(
    (currentReimbursementId) => {

      /** @type {Reimbursement} */
      let reimbursement = {
        account,
        amount : Number(reimbursedTotal),
        reimbursementId : Number(currentReimbursementId),
        transactions : {}
      }
      applyTimeStamp(toBeReimbursed, "reimbursedTime")
      applyTimeStamp(toBeReimbursed, "timeStamp")
      for (let transaction of toBeReimbursed) {
        transaction['reimbursedBy'] = req.session.username;
        reimbursement.transactions[transaction.transactionId.toString()] = transaction
      }

      addToReimbursementsToSign(reimbursement, account)

      currentReimbursementId = currentReimbursementId + 1
      updateReimburseId(currentReimbursementId, account)


    }
  )
  
})

app.post("/reimbursement/completed", async (req, res) => {

  /** @type {{reimbursement : Reimbursement}} */
  let { reimbursement } = req.body
  reimbursement = JSON.parse(reimbursement)
  /** @type {{account : string}} */
  let {account} = req.session

  deleteReimbursement(reimbursement, account)
  .then(() => res.redirect("/transaction_sign"))

  new Promise((resolve, reject) => {
    let transactions = Object.values(reimbursement.transactions)
    applyTimeStamp(transactions, "completedTime")
    applyTimeStamp(transactions, "timeStamp")
    addToTransactionHistory(transactions, account)
  })

  addToReimbursementHistory(reimbursement, account)

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

app.post("/transaction/approve", (req, res) => {
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


app.post('/upload/sign', upload.single('file'), async (req, res) => {
  try {

    if (!req.file) return res.status(400).send('No files were uploaded.');
    const file = req.file;
    let filename = file.originalname
  
    /** @type {{account: string}} */
    let {account} = req.session

    /** @type {string} */
    let transactionId  = req.body.transactionId

    /** @type {Reimbursement} */
    let reimbursement = JSON.parse(req.body.reimbursement)

    if (!transactionId) return res.status(400).send('transaction id is missing.')
    filename = account+"_"+transactionId+"_"+filename
    let imageUrl = await uploadImageToStorage(file, filename)

    let transaction = reimbursement.transactions[transactionId]
    transaction.imageUrl = imageUrl
    transaction.filename = filename
    updateReimbursement(reimbursement, account)
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
 * @returns {Promise<number>} 
 */
async function getCurrentTransactionId(account) {
  let {transactionId} = (await (firestore
  .collection(database)
  .doc(account)
  .get())).data()
  return transactionId

}

/**
 * @param {string} account
 * @returns {Promise<number>}
 */
async function getCurrentReimbursementId(account) {
  let {reimburseId} = (await (firestore
    .collection(database)
    .doc(account)
    .get()
  )).data()
  return reimburseId
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
    /** @type {Array<Transaction>} */
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
 * @param {string} account 
 * @returns {Promise<Array<Reimbursement>>}
 */
async function getReimbursements(account) {
  const snapshots = (await 
    firestore
    .collection(database)
    .doc(account)
    .collection('Reimbursements')
    .get()
  )
  /** @type {Array<Reimbursement>} */
  let reimbursements = []

  snapshots.forEach((doc) => {
    reimbursements.push(doc.data())
  })
  return reimbursements
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
 * @param {number} reimburseId 
 * @param {string} account 
 */
async function updateReimburseId(reimburseId, account) {
  return firestore
  .collection(database)
  .doc(account)
  .update({reimburseId})
}

/**
 * 
 * @param {Reimbursement} reimbursement 
 * @param {string} account
 */
async function addToReimbursementsToSign(reimbursement, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Reimbursements')
  .doc(reimbursement.reimbursementId.toString())
  .set(reimbursement)
}

/**
 * 
 * @param {Reimbursement} reimbursement 
 * @param {string} account 
 */
async function updateReimbursement(reimbursement, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Reimbursements')
  .doc(reimbursement.reimbursementId.toString())
  .update(reimbursement)

}

/**
 * 
 * @param {Reimbursement} reimbursement 
 * @param {string} account 
 */
async function deleteReimbursement(reimbursement, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Reimbursements')
  .doc(reimbursement.reimbursementId.toString())
  .delete()
}

/**
 * 
 * @param {Reimbursement} reimbursement 
 * @param {string} account 
 */
async function addToReimbursementHistory(reimbursement, account) {

  let reimbursementCopy = {...reimbursement}
  reimbursementCopy.transactions = Object
  .values(reimbursement.transactions)
  .map(transaction => transaction.transactionId)

  /** @type {ReimbursementRecord} */
  let reimbursementRecord = reimbursementCopy
  
  return firestore
  .collection(database)
  .doc(account)
  .collection('Reimbursement History')
  .doc(reimbursementRecord.reimbursementId.toString())
  .set(reimbursementRecord)
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
 * @param {Array<Object>} objects 
 * @param {string} purpose 
 */
function applyTimeStamp(objects, purpose) {
  const date = new Date();
  const options = { timeZone: 'America/Guyana',  timeZoneName: 'short' };
  const formattedDate = date.toLocaleString('en-US', options);
  for (let object of objects) {
    object[purpose] = formattedDate
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

/**
 * Represents a reimbursement
 * @typedef {Object} Reimbursement
 * @property {number} reimbursementId - The ID fo the reimbursement
 * @property {amount} amount - The total amount being reimbursed
 * @property {string} account - The account that the reimbursement is for.
 * @property {Object<string, Transaction?>} transactions - The transactions to be reimbursed
 * @property {boolean?} signed - If the transaction was signed
 * @property {string?} signedBy - The user that signed the transaction
 * @property {string?} signedTime - The time the user signed the transaction
 * @property {boolean?} collected - If the reimbursement amount was collected
 * @property {string?} collectedBy - The user that collected the reimbursement amount
 * @property {string?} collectedTime - The time the user collected the reimbursement amount
 */

/**
 * Represents a reimbursement in the database history
 * @typedef {Object} ReimbursementRecord
 * @property {number} reimbursementId - The ID fo the reimbursement
 * @property {amount} amount - The total amount being reimbursed
 * @property {string} account - The account that the reimbursement is for.
 * @property {Array<number>} transactions - The transaction Ids that have been reimbursed
 * @property {boolean} signed - If the transaction was signed
 * @property {string} signedBy - The user that signed the transaction
 * @property {string} signedTime - The time the user signed the transaction
 * @property {boolean} collected - If the reimbursement amount was collected
 * @property {string} collectedBy - The user that collected the reimbursement amount
 * @property {string} collectedTime - The time the user collected the reimbursement amount
 */


//TODO
//Transactions with receipts do not show up in query
//Upload images to google drive
//Taxable transactions