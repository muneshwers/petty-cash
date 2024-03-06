import express from "express"

const app = express()
const PORT = process.env.PORT || 3000
app.set("view engine", "ejs")

app.get("/",(req, res) => {
  res.render("home", {message: "hello godfrey"})
})

app.get("/balance", (req, res) => {
  let balance = 5000
  res.json({balance})
})

app.listen(PORT, () => {
  console.log("App is running...")
})
