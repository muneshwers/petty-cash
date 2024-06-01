import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"
import serviceAccount from "../serviceAccountKey.json" assert {type : "json"}
import config from "../config.js"

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "projectservers.appspot.com",
});

const firestore = getFirestore(firebaseApp)
const storage = getStorage(firebaseApp)

/** @type {{database : string }} */
const {database} = config

/**
 * 
 * @param {string} username 
 * @returns {Promise<User?>}
 */
export async function getUser(username) {
  return (await firestore
    .collection(database)
    .doc('Users')
    .collection('users')
    .doc(username)
    .get()).data()
}

/**
 * 
 * @param {User} user 
 * @returns 
 */
export async function createUser(user) {
  return (firestore
    .collection(database)
    .doc('Users')
    .collection('users')
    .doc(user.username)
    .set(user)
  )
}

/**
 * 
 * @param {string} account 
 * @returns {Promise<number>}
 */
export async function getCurrentBalance(account) {
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
export async function getCurrentTransactionId(account) {
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
export async function getCurrentReimbursementId(account) {
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
export async function getTransactions(account) {
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
export async function getReimbursements(account) {
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
 * @param {string} account 
 * @param {string} reimbursementId 
 * @returns 
 */
export async function getReimbursement(account, reimbursementId) {
  return (await 
    (firestore
      .collection(database)
      .doc(account)
      .collection('Reimbursements')
      .doc(reimbursementId)
      .get()
    )
  ).data()
}

/**
 * 
 * @param {string} transactionId 
 * @param {string} account 
 * @returns {Promise<Transaction>}
 */
export async function getTransaction(transactionId, account) {
  return (await firestore
    .collection(database)
    .doc(account)
    .collection('Transactions')
    .doc(transactionId)
    .get()
    ).data()
}

export async function updateBalance(balance, account) {
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
export function setTransactions(transactions, account) {
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
export function updateTransaction(transaction, account) {
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
export function deleteTransactions(transactions, account) {
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
export function deleteTransaction(transaction, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Transactions')
  .doc(transaction.transactionId.toString())
  .delete()
}


export async function updateTransactionId(transactionId, account) {
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
export async function updateReimburseId(reimburseId, account) {
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
export async function addToReimbursementsToSign(reimbursement, account) {
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
export async function updateReimbursement(reimbursement, account) {
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
export async function deleteReimbursement(reimbursement, account) {
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
export async function addToReimbursementHistory(reimbursement, account) {
  return firestore
  .collection(database)
  .doc(account)
  .collection('Reimbursement History')
  .doc(reimbursement.reimbursementId.toString())
  .set(reimbursement)
}

/**
 * 
 * @param {Array<Transaction>} transactions 
 * @param {string} account
 * @returns {Array<Promise>}
 */
export async function addToTransactionHistory(transactions, account) {
  return transactions.map(transaction => firestore
    .collection(database)
    .doc(account)
    .collection('History')
    .add(transaction)
  )
}

/**
 * 
 * @param {string} account 
 * @returns {Promise<Array<Transaction>>}
 */
export async function getTransactionsHistory(account) {
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
 * @param {string} account 
 * @returns {Promise<Array<Reimbursement>>}
 */
export async function getReimbursementsHistory(account) {
  try {
    const snapshots = (await firestore
    .collection(database)
    .doc(account)
    .collection('Reimbursement History')
    .orderBy("reimbursementId", 'desc')
    .get())
    /** @type {Array<Reimbursement>}*/
    let reimbursements = []
    snapshots.forEach((doc) => {
      reimbursements.push(doc.data())
    })
    return reimbursements
  } catch (error) {
    console.error("Error reading reimbursement history:", error);
    return []
  }
}

/**
 * 
 * @param {string} account 
 * @param {number} transactionId 
 */
export async function queryTransaction(account, transactionId) {
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
 * @param {string} account 
 * @param {string} email 
 * @returns {Promise<string>}
 */
export async function getRecipients(account, email) {
  let {recipient} = await firestore
  .collection(database)
  .doc(account)
  .collection('Email')
  .doc(email)
  .get()

  return recipient
}

/**
 * 
 * @param {Express.Multer.File} file 
 * @param {string} filename 
 * @returns {Promise<string>}
 */
export async function uploadImageToStorage(file, filename) {
  const uploadResponse = await storage.bucket().upload(file.path, {destination: filename})
  const url = (await uploadResponse[0].getSignedUrl({action: 'read', expires : "01-01-3000"}))[0]
  return url

}

/**
 *
 * @param {string} path 
 * @return {Promise}
 */
export async function deleteImageFromStorage(path) {
  const file = storage.bucket().file(path)
  if (!file) {
    throw Error("image not found")
  }
  return file.delete()
}

/**
 * 
 * @param {string} filename 
 * @returns 
 */
export async function downloadImageFromStorage(filename) {
  return storage.bucket().file(filename).download()
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
