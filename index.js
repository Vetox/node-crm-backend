var express = require('express');
const bodyParser = require('body-parser');
var cors = require('cors');
const fs = require('fs');
const jwt = require("jsonwebtoken");
const url = require('url');

var app = express();

app.use(cors());

const MongoClient = require('mongodb').MongoClient;

var randomstring = require("randomstring");

const uri = "mongodb+srv://userOne:userOne@cluster0-4ntyu.mongodb.net/apple?retryWrites=true&w=majority";

app.use(bodyParser.json());

const bcrypt = require('bcrypt');

require('dotenv').config();

const jwtKey = "SecretShhhhhhh_djkasdjaskjdlasjdlkasdj";

var nodemailer = require('nodemailer');
const { query } = require('express');
const { JsonWebTokenError } = require('jsonwebtoken');

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASS
    }
});


var server = app.listen(process.env.PORT || 8080, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log("Example app listening at http://%s:%s", host, port)
})



app.get('/', function (req, res) {
    res.status(200).send('/register to register. /login to login. /reset to reset password');
})


app.post("/register", function (req, res) {
    var email = req.body.email;
    var pass = req.body.pass;

    console.log(req.body);

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                console.log("Present");
                res.status(400).send("Email already Registered !");
            }
            else {
                console.log("Not Present");
                bcrypt.hash(pass, 10, function (err, hash) {
                    let secretString = randomstring.generate(4);
                    let verifyString = randomstring.generate(4);
                    var testObj = { email: email, pass: hash, secretString: secretString, verifyString: verifyString, verified: false, role: "Employee" };
                    console.log(testObj);
                    dbObject.collection("userCollTwo").insertOne(testObj, function (err, resp) {
                        if (err) throw err;
                        res.end("Email Registered ! Check inbox for verification link !");
                        sendVerifyMail(email);
                        db.close();
                    });
                });
            }
        })
    });
});




app.post("/login", function (req, res) {
    var email = req.body.email;
    var pass = req.body.pass;

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        var testObj = { email: email, pass: pass };

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                console.log(data[0]);
                if (data[0].verified === false) {
                    res.status(200).json({ message: "Please verify email !" });
                }
                else {
                    bcrypt.compare(pass, data[0].pass, function (err, result) {
                        console.log(result);
                        if (result) {
                            let token = jwt.sign({ email: data[0].email }, jwtKey, { expiresIn: 86400 });
                            res.status(200).json({ message: "Valid login", token: token });
                        } else {
                            res.status(200).json({ message: "Invalid credentials !" });
                        }
                    });
                }
            }
            else {
                console.log("Not Present");
                res.status(200).json({ message: "Email not registered !" });
            }
        });
        db.close();
    });
});

app.post("/resendVerificationMail", function (req, res) {
    let email = req.body.email;
    sendVerifyMail(email);
    res.status(200).end("Verification email send again !");
});

app.get("/dashboard", [tokenAuthorization], function (req, res) {

    var authToken = req.headers.authorization;

    var value = jwt.verify(authToken, jwtKey);

    var email = value['email'];

    const client = new MongoClient(uri, { useNewUrlParser: true });

    var output = [];

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        dbObject.collection("urlCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            console.log(data);
            for (let i = 0; i < data.length; i++) {
                output.push(data[i]);
            }
            return res.status(200).json(output);
        });
    });
});

function tokenAuthorization(req, res, next) {
    let authToken = req.headers.authorization;

    if (authToken === undefined) {
        return res.status(401).json({ message: "Unauthorized User" });
    }
    else {
        jwt.verify(authToken, jwtKey, (err, value) => {
            if (err) {
                return res.status(401).json({ message: "Unauthorized Access" });
            }
            else {
                console.log(value);
                next();
            }
        });
    }
}

function AdminRoleCheck(req, res, next) {

    let authToken = req.headers.authorization;

    var value = jwt.verify(authToken, jwtKey);

    var email = value['email'];

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        var testObj = { email: email };

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                if (data[0].role === "Admin") {
                    next();
                }
                else {
                    return res.status(401).json({ message: "Unauthorized Access" });
                }
            }
            else {
                return res.status(404).json({ message: "User Not Found" });
            }
            db.close();
        });
    });

}

function getEmailFromToken(req) {
    let authToken = req.headers.authorization;

    if (authToken === undefined) {
        return null;
    }
    else {
        jwt.verify(authToken, jwtKey, (err, value) => {
            if (err) {
                return null;
            }
            else {
                console.log(value);
                return value['email'];
            }
        });
    }
}


app.get("/verify", function (req, res) {

    const queryObject = url.parse(req.url, true).query;

    var email = queryObject['email'];
    var verifyString = queryObject['verifyString'];

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        var testObj = { email: email };

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                if (data[0].verified === true) {
                    res.end("Account already verified !");
                }
                else {
                    if (data[0].verifyString === verifyString) {

                        var newvalues = { $set: { email: data[0].email, pass: data[0].pass, secretString: data[0].secretString, verifyString: data[0].verifyString, verified: true } };

                        dbObject.collection("userCollTwo").updateOne({ email: email }, newvalues, function (dberr, dbdata) {
                            if (dberr) throw dberr;
                            res.status(200).send("Account verified");
                        });
                    }
                    else {
                        res.end("Invalid verification link");
                    }
                }
            }
            else {
                res.end("Invalid verification link");
            }
            db.close();
        });
    });
});

app.post("/assignAsAdmin", function (req, res) {

    var email = req.body.email;
    var adminApiKey = req.body.apiKey;

    if(adminApiKey !== process.env.ADMIN_API_KEY){
        
        res.status(401).end("Invalid Admin API Key");
        return;
    }

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        var testObj = { email: email };

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {

                var newvalues = { $set: { role: "Admin" } };

                dbObject.collection("userCollTwo").updateOne({ email: email }, newvalues, function (dberr, dbdata) {
                    if (dberr) throw dberr;
                    res.status(200).send("Account set as Admin");
                });

            }
            else {
                res.end("Invalid verification link");
            }
            db.close();
        });
    });
});

var validLeadStatuses = ["New", "Contacted", "Qualified", "Lost", "Cancelled", "Confirmed"];

app.post("/createNewLead", [tokenAuthorization], function (req, res) {

    let authToken = req.headers.authorization;

    if (authToken === undefined) {
        res.status(401).end("Unauthorized");
    }
    else {
        var value = jwt.verify(authToken, jwtKey);

        var email = value['email'];

        var leadName = req.body.leadName;
        var leadNotes = req.body.leadNotes;

        const client = new MongoClient(uri, { useNewUrlParser: true });

        client.connect(function (err, db) {
            if (err) throw err;

            var dbObject = db.db("crm5");

            var dbRecord = { Name: leadName, Status: "New", Notes: leadNotes, createdBy: email };

            dbObject.collection("leadDB").find({ Name: leadName }).toArray(function (error, data) {
                if (error) throw error;
                if (data.length === 0) {

                    dbObject.collection("leadDB").insertOne(dbRecord, function (error2, data) {
                        if (error2) throw error2;
                        res.status(200).json({ message: "Lead Added" });
                        db.close();
                    });

                }
                else {
                    res.status(401).json({ message: "Lead Name already Present" });
                }
            });
        });

    }
});

app.post("/viewLead", [tokenAuthorization], function (req, res) {

    let authToken = req.headers.authorization;

    if (authToken === undefined) {
        res.status(401).end("Unauthorized");
    }
    else {
        var value = jwt.verify(authToken, jwtKey);

        var email = value['email'];

        const client = new MongoClient(uri, { useNewUrlParser: true });

        client.connect(function (err, db) {
            if (err) throw err;

            var dbObject = db.db("crm5");

            dbObject.collection("leadDB").find({ createdBy: email }).toArray(function (error, data) {
                if (error) throw error;
                if (data.length === 0) {
                    res.status(401).json({ message: "No leads found" });
                }
                else {
                    res.status(200).json(data);
                }
            });
        });

    }
});


app.post("/deleteLead", [tokenAuthorization, AdminRoleCheck], function (req, res) {

    let authToken = req.headers.authorization;

    if (authToken === undefined) {
        res.status(401).end("Unauthorized");
    }
    else {
        var value = jwt.verify(authToken, jwtKey);

        var email = value['email'];

        var leadName = req.body.leadName;

        const client = new MongoClient(uri, { useNewUrlParser: true });

        client.connect(function (err, db) {
            if (err) throw err;

            var dbObject = db.db("crm5");

            dbObject.collection("leadDB").find({ Name: leadName }).toArray(function (error, data) {
                if (error) throw error;
                if (data.length === 0) {

                    res.status(401).json({ message: "Lead Name Not Found" });

                }
                else {
                    dbObject.collection("leadDB").remove({ Name: leadName }, function (error2, data) {
                        if (error2) throw error2;
                        res.status(200).json({ message: "Lead Deleted" });
                        db.close();
                    });

                }
            });
        });

    }
});

app.post("/updateLead", [tokenAuthorization], function (req, res) {

    let authToken = req.headers.authorization;

    if (authToken === undefined) {
        res.status(401).end("Unauthorized");
    }
    else {
        var value = jwt.verify(authToken, jwtKey);

        var email = value['email'];

        var leadName = req.body.leadName;

        const client = new MongoClient(uri, { useNewUrlParser: true });

        client.connect(function (err, db) {
            if (err) throw err;

            var dbObject = db.db("crm5");

            dbObject.collection("leadDB").find({ Name: leadName }).toArray(function (error, data) {
                if (error) throw error;
                if (data.length === 0) {
                    res.status(401).json({ message: "Lead Name Not Present" });
                }
                else {

                    let leadNotes = (req.body.leadNotes === undefined) ? data[0].Notes : req.body.leadNotes;
                    let leadStatus = (req.body.leadStatus === undefined) ? data[0].Status : req.body.leadStatus;

                    if (leadStatus !== undefined) {
                        if (!validLeadStatuses.includes(leadStatus)) {
                            res.status(400).end("Invalid Lead Status");
                        }
                    }
                    else {
                        var newvalues = { $set: { Name: leadName, Status: leadStatus, Notes: leadNotes } };

                        dbObject.collection("leadDB").updateOne({ Name: leadName }, newvalues, function (dberr, dbdata) {
                            if (dberr) throw dberr;
                            res.status(200).send("Lead updated");
                            db.close();
                        });
                    }
                }
            });
        });
    }
});


function sendVerifyMail(email) {

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        var testObj = { email: email };

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                console.log(email + " : " + data[0].verifyString);
                console.log(`Email Pass = ${process.env.EMAIL_PASS}`);
                let htmlString = `<a href="${process.env.SERVER}verify?email=${email}&verifyString=${data[0].verifyString}">Click here to verify account !</a>`;
                console.log(htmlString);
                var mailOptions = {
                    from: 'karthikeyan1997@gmail.com',
                    to: email,
                    subject: 'CRM Verification Mail',
                    text: "Click here to verify account !",
                    html: htmlString
                };

                var email_smtp = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    auth: {
                        type: "login", // default
                        user: `${process.env.EMAIL_ID}`,
                        pass: `${process.env.EMAIL_PASS}`
                    }
                });

                email_smtp.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                        //res.status(500).send("error");
                    } else {
                        console.log('Verification Email sent: ' + info.response);
                        //res.status(200).send('Verification Email sent: ' + info.response);
                    }
                });
            }
            else {
                console.log("Not Present");
                //res.status(400).send("Email not registered !");
            }
        })
    });
}

app.post("/resetStepOne", function (req, res) {
    var email = req.body.email;

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        var testObj = { email: email };

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                var mailOptions = {
                    from: 'karthikeyan1997@gmail.com',
                    to: email,
                    subject: 'URL Shortener password reset',
                    text: 'The secret is ' + data[0].secretString
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                        res.status(500).send("Error ! Please try again !");
                    } else {
                        console.log('Email sent: ' + info.response);
                        res.status(200).send('Email sent. Check Inbox');
                    }
                });
            }
            else {
                console.log("Not Present");
                res.status(400).send("Email not registered !");
            }
        })
    });
});

app.post("/resetStepTwo", function (req, res) {
    let secret = req.body.secret;
    let email = req.body.email;
    let newPass = req.body.newPass;

    const client = new MongoClient(uri, { useNewUrlParser: true });

    client.connect(function (err, db) {
        if (err) throw err;

        var dbObject = db.db("crm5");

        dbObject.collection("userCollTwo").find({ email: email }).toArray(function (err, data) {
            if (err) throw err;
            if (data.length > 0) {
                if (data[0].secretString === secret) {
                    let secretString = randomstring.generate(4);
                    bcrypt.hash(newPass, 10, function (error, hash) {
                        var newvalues = { $set: { email: email, pass: hash, secretString: secretString } };

                        dbObject.collection("userCollTwo").updateOne({ email: email }, newvalues, function (dberr, dbdata) {
                            if (dberr) throw dberr;
                            res.status(200).send("Password updated");
                            db.close();
                        });
                    });
                }
                else {
                    res.status(400).send("Invalid secret");
                }
            }
            else {
                console.log("Not Present");
                res.status(400).send("Email not registered !");
            }
        })
    });
});