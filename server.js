import express from "express"
// import bodyParser from "body-parser"

const app = express()
const PORT = process.env.PORT || 3000
const transactionLog = []
let balance = 5000 //Initializes balance with 5000 when server starts

app.set("view engine", "ejs")
app.use("/styles", express.static("styles"))
// app.use(bodyParser.urlencoded({extended :true}))
app.use(express.json());

app.get("/",(req, res) => {
  res.render("home")
})

app.get("/login", (req, res) => {
  const { username, password } = req.body
})

app.get("/balance", (req, res) => {
  res.json({balance})
})

//Receives data from form body and pushes to transactionLog array
app.post("/transactions", async (req, res) => {
  const data = await req.body;
  const {recipient, description, amount, date, createdBy } = data;
  balance = balance - amount;
  transactionLog.push(data);
  console.log(transactionLog);
  console.log("(Server Action) Balance is now $" + balance);
  console.log("(Server Action) Data Received: "+ recipient + " , " + description  + " , " + amount  + " , " + date + " , " + createdBy);
})

//Sends the transactionLog to client
app.get("/transactions", async (req, res) => {
  res.json({transactionLog})
  console.log("(Server Action) Returning transactions log")
  // console.log(transactionLog)
})

app.listen(PORT, () => {
  console.log("App is running...")
})
