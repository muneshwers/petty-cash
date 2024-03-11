import express from "express";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Function to read users from the JSON file
function getUsers() {
    const usersData = fs.readFileSync('users.json');
    return JSON.parse(usersData);
}

// Authentication endpoint
app.post('/authenticate', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    // Check if the username exists and the password matches
    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        res.sendStatus(200); // Authentication successful
    } else {
        res.sendStatus(401); // Unauthorized
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

