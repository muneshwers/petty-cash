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
app.use(expressSession({
  secret: 'hi123',
  resave: false,
  saveUninitialized: false
}));

let balance = 5000;
let transactions = [];

function getUsers() {
  const usersData = fs.readFileSync('C:/Users/gtaylor/Documents/GitHub/petty-cash/database/users.json');
  const usersJsonString = usersData.toString('utf-8');
  const users = JSON.parse(usersJsonString).users; 
  return users;
}


app.get("/", (req, res) => {
  if (!req.session.loggedIn) {
    res.redirect("/login");
  } else {
    res.render("home", { balance, transactions, currentUser: req.session.username });
  }
});

app.get("/login", (req, res) => {
  res.render("login", { errorMessage: '' });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();

  let errorMessage = ''; 

  const user = users.find(user => user.username === username && user.password === password);

  if (!user) {
    errorMessage = "Invalid username or password. Please try again."; 
    res.render("login", { errorMessage });
  } else {
    req.session.loggedIn = true;
    req.session.username = username;
    res.redirect("/");
  }
});




app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.sendStatus(500);
    } else {
      res.redirect("/login");
    }
  });
});

app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});

