import fs from "fs";
import express, { response } from "express";
import "dotenv/config"
import expressSession from "express-session";
import bodyParser from "body-parser";
import multer from "multer";
import * as Email from "./email.js"
import * as Database from "./database_functions.js"
import {createDriveFolder , uploadFileInDriveFolder} from "./gdrive.js"
import config from "../config.js"
import mime from "mime-types"
import * as path from "path"

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  dest: '/tmp/',
  fileFilter: (req, file, cb) => {
    const mimeType = mime.lookup(file.originalname);
    if (!mimeType) {
      cb(new Error('Invalid file type'));
    } else {
      cb(null, true);
    }
  }
})

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
  const user = await Database.getUsers(username);

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
  let balance = await Database.getCurrentBalance(req.session.account)
  res.json({balance})
})

app.get("/transactions", async (req, res) => {
  let transactions = await Database.getTransactions(req.session.account)
  res.json({transactions})
})

app.get("/reimbursements", async (req, res) => {
  let reimbursements = await Database.getReimbursements(req.session.account)
  res.json({reimbursements})
})

app.get("/reimbursements/history", async (req, res) => {
  let reimbursements = await Database.getReimbursementsHistory(req.session.account)
  res.json({reimbursements})
})

app.get("/transaction/query/:id", async (req, res) => {
  let id = Number(req.params.id)
  let {account} = req.session
  let docs = (await Database.queryTransaction(account, id)).docs
  let transactions = []
  for (let doc of docs) {
    transactions.push(doc.data())
  }
  res.json({transactions})
})

app.get("/transactionId", async (req, res) => {
  let transactionId = await Database.getCurrentTransactionId(req.session.account)
  res.json({transactionId})
})

app.get("/transactions/history", async (req, res) => {
  let {account} = req.session
  let transactionHistory = await Database.getTransactionsHistory(account)
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
  let { transactionId, recipient, supplier, description, amount, date, tax, taxable} = req.body
  transactionId = Number(transactionId)
  amount = Number(amount)
  tax = Number(tax)
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
  if (tax > 0) {
    transaction.taxable = true
    transaction.tax = tax
  }

  let currentId = await Database.getCurrentTransactionId(account) 
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
   Email.sendTransactionForApprovalEmailWithTimeout(account)
  }
  applyTimeStamp([transaction], "timeStamp")
  Database.setTransactions([transaction], account);
  
  let balance = await Database.getCurrentBalance(account)
  balance = balance - amount
  if (balance <= 100000) {
    Email.sendNearingLimitEmailWithTimout(account)
  }
  Database.updateBalance(balance, account)

  transactionId = Number(transactionId) + 1
  Database.updateTransactionId(transactionId, account)
  .then(() => {
    res.render("create_transaction")
  })

  
  
})

app.post("/transaction/edit", async (req, res) => {
  /** @type {Transaction} */
  let { transactionId, recipient, supplier, description, amount, date, tax, taxable } = req.body
  

  tax = Number(tax)
  taxable = (taxable == 'on') ? true : false
  tax = (taxable) ? tax : 0
  taxable = (tax == 0) ? false : taxable

  let amountChanged = (amount) ? true : false
  amount = Number(amount)
  transactionId = Number(transactionId)
  let transaction = {
    transactionId,
    recipient,
    supplier,
    description,
    amount,
    date,
    tax,
    taxable
  };

  let originalTransaction = await Database.getTransaction(
    transactionId.toString(), 
    req.session.account
  )

  if (!originalTransaction) {
    res.status(404).send("Transaction not found");
    return;
  }

  applyTimeStamp([originalTransaction], "editTime")
  originalTransaction.editedBy = req.session.username
  Database.addToTransactionHistory([{...originalTransaction}], req.session.account)
  if (!amountChanged) {
    transaction.amount = originalTransaction.amount
  }
  if (amountChanged) {
    let balance = await Database.getCurrentBalance(req.session.account)
    balance += (originalTransaction.amount - transaction.amount)
    Database.updateBalance(balance, req.session.account)

    if (amount < transactionApprovalLimit) {
      transaction["approved"] = true
      transaction["approvedBy"] = 'System'
      applyTimeStamp([transaction], "approvedTime")
    }
    if (amount >= transactionApprovalLimit) {
      transaction["approved"] = false
      transaction["approvedBy"] = ''
      transaction["approvedTime"] = ''
      Email.sendTransactionForApprovalEmailWithTimeout(req.session.account)
    }

  }
  applyTimeStamp([originalTransaction], "timeStamp")
  Object.assign(originalTransaction, transaction)
  Promise.all(Database.setTransactions([originalTransaction], req.session.account))
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

  Database.deleteTransaction(transaction, account)
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

  Database.addToTransactionHistory([transaction], account)
  .then(() => Email.sendTransactionDeletedEmail(account))

  Database.getCurrentBalance(account)
  .then((balance) => balance + transaction.amount)
  .then((newBalance) => Database.updateBalance(newBalance, account))

})

app.post("/reimbursement/sign", async (req, res) => {
  try {
    /** @type {{reimbursement : Reimbursement}} */
    let { reimbursement } = req.body;
    reimbursement = JSON.parse(reimbursement);
    /** @type {{account: string }} */
    let { account } = req.session;

    /** @type {Reimbursement}  */
    let reimbursementUpdate = {};
    reimbursementUpdate.reimbursementId = reimbursement.reimbursementId;
    reimbursementUpdate.signed = true;
    reimbursementUpdate.signedBy = req.session.username;

    applyTimeStamp([reimbursementUpdate], "signedTime");

    let transactions = Object.values(reimbursement.transactions);
    let transactionsWithImages = transactions.filter(transaction => transaction?.filename);

    Database.updateReimbursement(reimbursementUpdate, account)
    .then(() => {
      res.render("sign", { signApproval: true })

      let transactionForAdaptorServer = transactions.flatMap((transaction) => {
        if (!transaction.taxable) {
          return [transaction]
        }
    
        let transactionNoTax = {...transaction}
        transactionNoTax.amount = transaction.amount - transaction.tax
    
        let transactionTax = {...transaction}
        transactionTax.amount = transaction.tax
        transactionTax.description = `Tax ${transaction.description}`
    
        return [transactionNoTax, transactionTax]
      })
      sendReimbursementsToAdaptorServer(transactionForAdaptorServer)

      let promises = transactionsWithImages.map(transaction => 
        Database.downloadImageFromStorage(transaction.filename)
      );
      return Promise.all(promises);

    })
    .then((responses) => {
      const tmpDir = '/tmp'
      let writePromises = responses.map((response, index) => {
        let buffer = response[0];
        let filePath = path.join(tmpDir, transactionsWithImages[index].filename);
        return fs.promises.writeFile(filePath, buffer)
      })
  
      return Promise.all(writePromises) 
    })
    .then(async () => {

      const folderName = `${account}-${reimbursement.reimbursementId}`;
      const directoryPath = '/tmp';
  
      const { folderId, folderLink } = await createDriveFolder(folderName)

      transactionsWithImages.map((transaction) => {
        let filename = transaction.filename
        const filePath = path.join(directoryPath, filename)
        uploadFileInDriveFolder(filePath, filename, folderId)
        .then(() => fs.promises.unlink(filePath))
      })
      
      return folderLink
    })
    .then((folderLink) => {
      Email.sendTransactionSignedEmail(account, {folderLink})
    })


  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});


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

  Database.updateReimbursement(reimbursementUpdate, account).then(() => {
    res.redirect("/transaction_sign")
  })

  Database.getCurrentBalance(account).then((balance) => {
    balance = Number(balance) + Number(reimbursement.amount)
    Database.updateBalance(balance, account)
  })


})

app.post("/reimbursement", async (req,res)=> {
  /** @type {{reimbursedTotal:number, toBeReimbursed: Array<Transaction>}} */
  let { reimbursedTotal, toBeReimbursed } = req.body
  toBeReimbursed = JSON.parse(toBeReimbursed)

  /** @type {{account : string}} */
  let {account} = req.session
  Promise.all(Database.deleteTransactions(toBeReimbursed, account))
  .then(() => res.render("reimburse"))
  .then(() => Email.sendReimbursementsMadeWithTimeout(account))


  Database.getCurrentReimbursementId(req.session.account).then(
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

      Database.addToReimbursementsToSign(reimbursement, account)

      currentReimbursementId = currentReimbursementId + 1
      Database.updateReimburseId(currentReimbursementId, account)


    }
  )
  
})

app.post("/reimbursement/completed", async (req, res) => {

  /** @type {{reimbursement : Reimbursement}} */
  let { reimbursement } = req.body
  reimbursement = JSON.parse(reimbursement)
  /** @type {{account : string}} */
  let {account} = req.session

  Database.deleteReimbursement(reimbursement, account)
  .then(() => res.redirect("/transaction_sign"))

  new Promise((resolve, reject) => {
    let transactions = Object.values(reimbursement.transactions)
    applyTimeStamp(transactions, "completedTime")
    applyTimeStamp(transactions, "timeStamp")
    Database.addToTransactionHistory(transactions, account)
  })

  Database.addToReimbursementHistory(reimbursement, account)

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
  Database.updateTransaction(transactionUpdate, account)
  .then(() => res.sendStatus(200))
  .then(() => Email.sendApprovalMadeEmailWithTimeout(account))
});

app.post('/upload', upload.single('file'), async (req, res) => {

  if (!req.file) return res.status(400).send('No files were uploaded.');
  const file = req.file

  let filename = file.originalname

  let ext = findExtName(filename)
  let allowedExtension = ['jpeg', 'jpg', 'png', 'pdf']
  if(!ext || !allowedExtension.includes(ext.toLowerCase())){
    res.sendStatus(400)
    fs.unlink(file.path, (err) => {
      if (err) console.error(err)
    })
    return
  }

  /** @type {{account: string}} */
  let {account} = req.session

  /** @type {number} */
  let transactionId  = Number(req.body.transactionId)

  if (!transactionId) return res.status(400).send('transaction id is missing.')
  filename = account+"_"+transactionId.toString()+"_"+filename
  let imageUrl = await Database.uploadImageToStorage(file, filename)

  Database.updateTransaction({transactionId, imageUrl, filename}, account)
  .then(() => res.sendStatus(200))
  .then(() => fs.unlink(file.path, (err) => {
    if (err) {console.log(err)}
  }))
    

});


app.post('/upload/sign', upload.single('file'), async (req, res) => {
  
  if (!req.file) return res.status(400).send('No files were uploaded.');
  const file = req.file;
  let filename = file.originalname

  let ext = findExtName(filename)
  let allowedExtension = ['jpeg', 'jpg', 'png', 'pdf']
  if(!ext || !allowedExtension.includes(ext.toLowerCase())){
    res.sendStatus(400)
    fs.unlink(file.path, (err) => {
      if (err) console.error(err)
    })
    return
  }

  /** @type {{account: string}} */
  let {account} = req.session

  /** @type {string} */
  let transactionId  = req.body.transactionId

  /** @type {Reimbursement} */
  let reimbursement = JSON.parse(req.body.reimbursement)

  if (!transactionId) return res.status(400).send('transaction id is missing.')
  filename = account+"_"+transactionId+"_"+filename
  let imageUrl = await Database.uploadImageToStorage(file, filename)

  let transaction = reimbursement.transactions[transactionId]
  transaction.imageUrl = imageUrl
  transaction.filename = filename
  Database.updateReimbursement(reimbursement, account)
  .then(() => res.sendStatus(200))
  .then(() => fs.unlink(file.path, (err) => {
    if (err) {console.log(err)}
  }))

});


app.post('/upload/delete', (req, res) => {
  /** @type {{filename: string}} */
  let {filename} = req.body
  if (!filename) return
  try{
    Database.deleteImageFromStorage(filename)
    .then(() => res.sendStatus(200))
    .catch(() => res.sendStatus(500))
  }catch {
    res.sendStatus(500)
  }
})


app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});

const transactionApprovalLimit = 10001

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

/** @param {string} filename */
const findExtName = (filename) => filename.split(".").at(-1)

/**
 * 
 * @param {Array<Transaction>} transactions 
 */
function sendReimbursementsToAdaptorServer(transactions) {
  let {adaptorServerUrl} = config
  fetch(adaptorServerUrl, {
    method : "POST",
    headers : {
        "Content-Type" : "application/json"
    },
    body : JSON.stringify({reimbursements: transactions})
  }).then(
      (response) => console.log(response)
  )
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
 * @property {boolean} taxable - if the transcation can be taxed
 * @property {number} tax - the tax that the item carries
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

//TODO
//Taxable transactions