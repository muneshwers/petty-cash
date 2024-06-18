import fs from "fs";
import express from "express";
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
    "/styles/style.css",
    "/upload",
    "/upload/sign",
    "/reimbursement/get"
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
app.use("/dist", express.static("dist"));
app.use("/javascript", express.static("javascript"))
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
  let {account, views, landingInfo} = req.session
  let {database} = config
  res.render("home", {account, views, landingInfo, database})
})

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});


app.post("/login/user", async (req, res) => {
  const { username, password } = req.body;
  const user = await Database.getUser(username);

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

  let {views, landing, permissions} = user
  
  let pageMap = {
    "create" : {link : "/create_transaction", tab : "transactions"},
    "reimburse" : {link : "/reimburse", tab : "reimburse"} ,
    "history" : {link : "/transaction_history", tab : "history"},
    "sign" : {link : "/transaction_sign", tab : "sign"},
    "approve" : {link : "/approve", tab : "approve"},
    "users" : {link: "/create_user", tab : "users"}
  }
  let landingInfo = pageMap[landing.page]
  if (!landingInfo) {
    errorMessage = "User has no landing info"
    res.render("login", {errorMessage})
    return
  }

  req.session.loggedIn = true;
  req.session.username = username;
  req.session.account = landing.account;
  req.session.saved = {}
  req.session.views = views
  req.session.landingInfo = landingInfo
  req.session.permissions = permissions

  let {database} = config
  
  res.render("home", {
    account : req.session.account, 
    views, 
    landingInfo, 
    database
  })
  return
  
})

app.post("/user/create", (req ,res) => {
  let {name, password, pages, landingPage, accounts, landingAccount, permissions} = req.body
  pages =  (typeof pages == "string") ? [pages] : pages
  accounts = (typeof accounts == "string") ? [accounts] : accounts
  permissions = permissions ?? ["placeholder"]
  permissions = (typeof permissions == "string") ? [permissions] : permissions
  /** @type {Landing} */
  let landing = {
    account : landingAccount,
    page : landingPage
  }
  /** @type {User} */
  let user = {
    username : name,
    password : password,
    permissions : Object.fromEntries(permissions.map((permission) => [permission, true])),
    landing,
    views : Object.fromEntries(pages.concat(accounts).map((view) => [view, true]))
  }
  Database.createUser(user)
  res.redirect("/create_user")

})

app.post("/user/edit", (req ,res) => {
  let {name, password, pages, landingPage, accounts, landingAccount, permissions} = req.body
  pages =  (typeof pages == "string") ? [pages] : pages
  accounts = (typeof accounts == "string") ? [accounts] : accounts
  permissions = permissions ?? ["placeholder"]
  permissions = (typeof permissions == "string") ? [permissions] : permissions
  /** @type {Landing} */
  let landing = {
    account : landingAccount,
    page : landingPage
  }
  /** @type {User} */
  let user = {
    username : name,
    password : password,
    permissions : Object.fromEntries(permissions.map((permission) => [permission, true])),
    landing,
    views : Object.fromEntries(pages.concat(accounts).map((view) => [view, true]))
  }
  Database.updateUser(user)
  res.redirect("/edit_user")

})

app.get("/user/id/:username", (req, res) => {
  let {username} = req.params
  Database.getUser(username)
  .then((user) => {
    if (user) {
      res.status(200).json({user})
      return
    }
    res.sendStatus(400)
  })
  .catch(() => res.sendStatus(400))
})

app.get("/user/logout", async (req, res) => {
  req.session.destroy((err) => {
    res.render("login", {errorMessage : ''})
  })
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

// A hack so that we can pass the reimbursement id in the body and get passed the sign-in filter
app.post("/reimbursement/get", async (req, res) => {
  /** @type {{reimbursementId : string}} */
  let {reimbursementId} = req.body
  console.log({reimbursementId})
  let account = req.session.account ?? req.body.account
  Database.getReimbursement(account, reimbursementId.toString())
  .then((reimbursement) => res.json({reimbursement}))
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
  res.render("create_transaction", {balance : 200000, transactionId : ''})
})

app.get("/create_user", (req, res) => {
  res.render("create_user")
})

app.get("/edit_user", (req, res) => {
  res.render("edit_user")
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
  let { permissions } = req.session
  let { signApproval } = permissions
  signApproval = signApproval ?? false
  res.render("sign", {signApproval})
})

app.get("/saved", (req, res) => {
  let {account, saved} = req.session
  let savedOnAccount = saved[account] ?? []
  res.json({savedOnAccount})
})

app.post("/transaction", async (req ,res) => {

  /** @type {Transaction} */
  let { transactionId, recipient, supplier, description, amount, date, tax, balance} = req.body
  transactionId = Number(transactionId)
  amount = Number(amount)
  tax = Number(tax)
  balance = Number(balance)
  
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
  
  balance = balance - amount
  if (balance <= 100000) {
    Email.sendNearingLimitEmailWithTimout(account)
  }
  Database.updateBalance(balance, account)

  transactionId = Number(transactionId) + 1
  Database.updateTransactionId(transactionId, account)

  res.render("create_transaction", {balance, transactionId})
  
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
  /** @type {{transaction: Transaction, reason : string, source : string}} */
  let {transaction, reason, source} = req.body
  transaction = JSON.parse(transaction)
  /** @type {{account:string}} */
  let {account} = req.session

  applyTimeStamp([transaction], "deletedTime")
  applyTimeStamp([transaction], "timeStamp")
  transaction.deletedBy = req.session.username
  transaction.deleteReason = reason

  Database.deleteTransaction(transaction, account)
  .then(() => {
    res.render(source)
    return
  })

  Database.addToTransactionHistory([transaction], account)
  .then(() => Email.sendTransactionDeletedEmail(account))

  Database.getCurrentBalance(account)
  .then((balance) => balance + transaction.amount)
  .then((newBalance) => Database.updateBalance(newBalance, account))

})

app.post("/reimbursement/sign", async (req, res) => {
  try {
    console.log("here")
    console.log(req.body)
    /** @type {{reimbursement : Reimbursement}} */
    let { reimbursement } = req.body;
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
      res.sendStatus(200)
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

  /** @type {{account: string }} */
  let { account } = req.session

  /** @type {Reimbursement}  */
  let reimbursementUpdate = {}
  reimbursementUpdate.reimbursementId = reimbursement.reimbursementId
  reimbursementUpdate.collected = true
  reimbursementUpdate.collectedBy = req.session.username
  applyTimeStamp([reimbursementUpdate], "collectedTime")

  Database.updateReimbursement(reimbursementUpdate, account).then(() => {
    res.sendStatus(200)
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
  res.redirect(req.session.landingInfo.link)
  return
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

  /** @type {string} */
  let account = req.session.account ?? req.body.account

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

  /** @type {string} */
  let account = req.session.account ?? req.body.account

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


app.listen(PORT, async () => {
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
 * Represents a user
 * @typedef {Object} User
 * @property {string} username - The username
 * @property {string} password - The password
 * @property {Object<string, boolean>} views - The views that the user can see
 * @property {Object<string, boolean>} permissions - The permissions that the user has
 * @property {Landing} landing - The user's landing information
 */

/**
 * The information object about the user upon loading and landing on the site
 * @typedef {Object} Landing
 * @property {string} account - The account the user lands
 * @property {string} page - The page that the user lands
 */


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
//test