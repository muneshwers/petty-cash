import express from "express"
import bodyParser from "body-parser"

const app = express()
const PORT = process.env.PORT || 3000
app.set("view engine", "ejs")
app.use("/styles", express.static("styles"))
app.use(bodyParser.urlencoded({extended :true}))

app.get("/",(req, res) => {
  res.render("home")
})

app.get("/login", (req, res) => {
  const { username, password } = req.body
})

app.get("/balance", (req, res) => {
  let balance = 5000
  res.json({balance})
})

app.listen(PORT, () => {
  console.log("App is running...")
})
