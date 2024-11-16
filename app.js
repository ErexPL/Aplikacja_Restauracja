const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(
    session({
        secret: 'securekey',
        resave: false,
        saveUninitialized: false,
    })
);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const readDB = () => {
    const data = fs.readFileSync('db.json', 'utf8');
    return JSON.parse(data);
};

app.get('/', (req, res) => {
    if (req.session.loggedIn) {
        res.render('nav', { location: req.session.employee.restaurantLocation });
    } else {
        res.render('login');
    }
});

app.post('/login', (req, res) => {
    const { firstName, lastName, email } = req.body;
    const db = readDB();
    const employee = db.employees.find(
        emp =>
            emp.firstName === firstName &&
            emp.lastName === lastName &&
            emp.email === email
    );

    if (employee) {
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Kod weryfikacyjny',
            text: `Twój kod weryfikacyjny to: ${verificationCode}`,
        });

        req.session.verificationCode = verificationCode;
        req.session.employee = employee;

        res.redirect('/verify');
    } else {
        res.status(401).send('Nieprawidłowe dane.');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Nie można się wylogować.');
        }
        res.redirect('/');
    });
});

app.get('/verify', (req, res) => {
    if (!req.session.verificationCode) {
        return res.redirect('/');
    }
    res.render('verify');
});

app.post('/verify', (req, res) => {
    const { code } = req.body;

    if (parseInt(code) === req.session.verificationCode) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.status(401).send('Nieprawidłowy kod weryfikacyjny.');
    }
});

app.get('/admin1', (req, res) => {
    if (req.session.loggedIn) {
        res.render('admin1');
    } else {
        res.redirect('/');
    }
});

app.get('/admin2', (req, res) => {
    if (req.session.loggedIn) {
        res.render('admin2');
    } else {
        res.redirect('/');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
