var express = require('express');
var router = express.Router();
const connection = require('../db');
const {request, response} = require("express");

//get all users
router.get('/', (req, res) => {
  const query = "SELECT * FROM users";
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error executing the query: ' + err);
      res.status(500).send('Error retrieving data');
    } else {
      res.json(results);
    }
  });
});

//get user by id
router.get('/id', (req, res) => {
  const id = req.query.id; // Retrieve the 'id' parameter from the query string
  if (!id) {
    return res.status(400).send('No ID provided');
  }

  const query = `SELECT ID, name, Email, ProfilePicture, Username FROM users WHERE ID = ${id}`;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error executing the query: ' + err);
      res.status(500).send('Error retrieving data');
    } else {
      res.json(results[0]);
    }
  });
});

// Edit user details
router.post('/edit', async (req, res) => {
  const requestData = req.body;

  if (requestData.id) {
    const findUser = `SELECT * FROM users WHERE ID = ?`;
    connection.query(findUser, [requestData.id], async (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: "Error fetching users" });
      }else if (results.length > 0) {
        // Build query
        let dynamicQuery = "UPDATE users SET ";
        let setClauses = [];
        let queryParams = [];

        let changes = [];

        if (requestData.username && requestData.username.length > 5) {
          setClauses.push("Username = ?");
          queryParams.push(requestData.username);
          changes.push("username");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (requestData.email && requestData.email.length > 6 && emailRegex.test(requestData.email)) {
          setClauses.push("Email = ?");
          queryParams.push(requestData.email);
          changes.push("email")
        }

        if (requestData.name && requestData.name.length > 5) {
          setClauses.push("name = ?");
          queryParams.push(requestData.name);
          changes.push("name");
        }

        if (requestData.password && requestData.password.length > 3) {
          setClauses.push("Password = ?");
          queryParams.push(requestData.password);
          changes.push("password");
        }

        dynamicQuery += setClauses.join(", ");
        dynamicQuery += " WHERE ID = ?";
        queryParams.push(requestData.id);

        if(setClauses.length > 0){
          connection.query(dynamicQuery, queryParams, (err) => {
            if (err) {
              console.log("Error executing the query: " + err);
              return res.status(500).json({ error: 'Invalid query' });
            } else {
              return res.status(500).json({ "message": "user details updated", "changes": changes });
            }
          });

        }else{
          return res.status(400).json({ error: 'Invalid query' });
        }

      } else {
        return res.status(404).json({ message: 'No users found matching the given id' });
      }
    });
  } else {
    return res.status(400).json({ error: 'ID field is required' });
  }
});

//Logs user into system
router.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  // Use a parameterized query to avoid SQL injection
  const query = 'SELECT * FROM users WHERE Username = ? AND Password = ?';
  connection.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error executing the query: ' + err);
      res.status(500).send('Error retrieving data');
    } else {
      if (results.length === 1) {
        // User is authenticated
        // Set the cookie with serialized JSON data
        res.cookie('login', JSON.stringify({ username: results[0].Username, id: results[0].ID, date: new Date() }), { secure: true, httpOnly: true });
        res.json({ message: 'Login successful', username: results[0].Username, id: results[0].ID, date: new Date() });
      } else {
        // User not found or invalid credentials
        res.clearCookie('login');
        res.status(401).json({ message: `Incorrect password, please try again.` });
      }
    }
  });
});

router.post('/createAccount', (req, res) => {
  const accountData = req.body;
  if (
    accountData.name &&
    accountData.username &&
    accountData.email &&
    accountData.password
  ) {
    const query = "INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)";
    const values = [accountData.name, accountData.username, accountData.email, accountData.password];

    connection.query(query, values, (err) => {
      if (err) {
        console.log("Error executing the query:" + err);
        res.status(500).send("Error creating the user");
      } else {
        res.status(200).json(accountData);
      }
    });
  } else {
    res.status(400).json({ error: 'Invalid data format' });
  }
});

router.get('/findUser', (req, res) => {
  const searchTerm = req.query.searchTerm;

  if (searchTerm) {
    const query = `
      SELECT name, username, email
      FROM users
      WHERE username = ? OR email = ?
    `;

    connection.query(query, [searchTerm, searchTerm], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: "Error fetching users" });
      } else {
        if (results.length > 0) {
          return res.status(200).json(results);
        } else {
          return res.status(404).json({ message: 'No users found matching the search term' });
        }
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid search term' });
  }
});

router.post('/friend-requests/create', (req, res) => {
  const requestData = req.body;
  if (requestData.user1id && requestData.user2id) {
    // Check to see if an incoming request from the user already exists. if so, create the friendship right away.
    const check = "SELECT * FROM friends WHERE User1ID = ? AND User2ID = ? AND friends.Status = 'Pending'";

    connection.query(check, [requestData.user2id, requestData.user1id], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: "000PS! Something happened :(" });
      } else {
        if(results.length === 0){
          console.log("the length is 0. running the query to insert into");
          // There is no incoming request present. Send request as normal
          const query = "INSERT INTO friends (User1ID, User2ID, Status, Date) VALUES (?, ?, 'Pending', ?)";
          const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // TODO: use SQL version

          connection.query(query, [requestData.user1id, requestData.user2id, currentDate], (err, results) => {
            if (err) {
              console.log("Error executing the query: " + err);
              return res.status(500).json({ error: "000PS! Something happened :(" });
            } else {
              return res.status(200).json({ message: "Friend request created successfully" });
            }
          });
        }else{
          // An incoming friend request already exists. Create a friendship.
          const accept = "UPDATE friends SET Status = 'Accepted' WHERE User1ID = ? AND User2ID = ? AND Status = 'Pending'";
          connection.query(accept, [requestData.user2id, requestData.user1id], (err, results) => {
            if (err) {
              console.log("Error executing the query: " + err);
              return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
            } else {
              // create outgoing friendship relation
              const createEntry = "INSERT INTO friends (`User1ID`, `User2ID`, `Status`) VALUES (?, ?, 'Accepted')";
              connection.query(createEntry, [requestData.user1id, requestData.user2id], (err, results) => {
                if (err) {
                  console.log("Error executing the query: " + err);
                  return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
                } else {
                  return res.status(200).json({ message: "User added as friend" });
                }
              });
            }
          });
        }
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid data format' });
  }
});

router.get('/friend-requests/all', (req, res) => {
  const id = req.query.id;

  if (id) {
    const query = `
      SELECT friends.User1ID, friends.User2ID, friends.Date, users.name, users.username
      FROM friends, users
      WHERE friends.User1ID = users.id 
      AND friends.User2ID = ? 
      AND friends.Status = 'Pending'
    `;

    connection.query(query, [id], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: "Error fetching requests" });
      } else {
        if (results.length > 0) {
          return res.status(200).json(results);
        } else {
          return res.status(404).json({ message: 'No friend requests at this time' });
        }
      }
    });
  } else {
    return res.status(400).json({ error: 'OOOPS! Something happened :(' });
  }
});

router.post('/friend-requests/respond', (req, res) => {
  const requestData = req.body;

  // Check if accepted or rejected
  if (requestData.user1id && requestData.user2id && requestData.decision === 'Accepted') {
    // Request was accepted; accept incoming
    const query = "UPDATE friends SET Status = ? WHERE User1ID = ? AND User2ID = ? AND Status = 'Pending'";
    connection.query(query, [requestData.decision, requestData.user1id, requestData.user2id], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
      } else {
        // create outgoing friendship relation
        const createEntry = "INSERT INTO friends (`User1ID`, `User2ID`, `Status`) VALUES (?, ?, ?)";
        connection.query(createEntry, [requestData.user2id, requestData.user1id, requestData.decision], (err, results) => {
          if (err) {
            console.log("Error executing the query: " + err);
            return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
          } else {
            return res.status(200).json({ message: "Request accepted" });
          }
        });
      }
    });
  } else if(requestData.user1id && requestData.user2id && requestData.decision === 'Rejected'){
    // Request was rejected; delete existing request
    const query = "DELETE FROM friends WHERE User1ID = ? AND User2ID = ? AND Status = 'Pending'";
    connection.query(query, [requestData.user1id, requestData.user2id, requestData.decision], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
      } else {
        return res.status(200).json({ message: "Request rejected" });
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid data format' });
  }
});

router.post('/friends/remove', (req, res) => {
  const requestData = req.body;
  if (requestData.user1id && requestData.user2id) {
    const query = "DELETE FROM friends WHERE User1ID = ? AND User2ID = ? AND Status = 'Accepted'";
    connection.query(query, [requestData.user1id, requestData.user2id, requestData.decision], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
      } else {
        connection.query(query, [requestData.user2id, requestData.user1id, requestData.decision], (err, results) => {
          if (err) {
            console.log("Error executing the query: " + err);
            return res.status(500).json({ error: 'OO0OPS! Something happened :(' });
          } else {
            return res.status(200).json({ message: "Friendship removed" });
          }
        });
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid data format' });
  }
});

router.get('/friends/all', (req, res) => {
  const id = req.query.id;

  if (id) {
    const query = `
      SELECT friends.User1ID, friends.User2ID, friends.Date, users.name, users.username
      FROM friends, users
      WHERE (friends.User1ID = ? OR friends.User2ID = ?)
      AND friends.Status = 'Accepted'
      AND friends.User2ID = users.id
      AND users.id != ?
    `;
    connection.query(query, [id, id, id], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: "OO0OPS! Something happened :(" });
      } else {
        if (results.length > 0) {
          return res.status(200).json(results);
        } else {
          return res.status(404).json({ message: 'No friends on songsnap!' });
        }
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid data format' });
  }
});

router.get('/blocked-users/all', (req, res) => {
  const id = req.query.id;

  if (id) {
    const query = `
      SELECT blocked.User2ID, users.name, users.username
      FROM blocked, users
      WHERE blocked.User1ID = ? AND blocked.User2ID = users.id;
    `;

    connection.query(query, [id], (err, results) => {
      if (err) {
        console.log("Error executing the query: " + err);
        return res.status(500).json({ error: "OO0OPS! Something happened :(" });
      } else {
        if (results.length > 0) {
          return res.status(200).json(results);
        } else {
          return res.status(404).json({ message: 'No blocked users' });
        }
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid data format' });
  }
});

router.post('/blocked-users/create', (req, res) => {
  const requestData = req.body;
  if (requestData.user1 && requestData.user2 && requestData.user1 !== requestData.user2) {
    const selectQuery = "SELECT * FROM blocked WHERE (User1ID = ? AND User2ID = ?) OR (User1ID = ? AND User2ID = ?)";
    const insertQuery = "INSERT INTO blocked (User1ID, User2ID) VALUES (?, ?)";

    connection.query(selectQuery, [requestData.user1, requestData.user2, requestData.user2, requestData.user1], (selectErr, selectResults) => {
      if (selectErr) {
        console.log("Error executing the select query: " + selectErr);
        return res.status(500).json({ error: "Oops! Something happened :(" });
      }

      if (selectResults.length > 0) {
        // Entry already exists, return a message or status
        return res.status(200).json({ message: "Entry already exists" });
      } else {
        // Entry does not exist, perform the INSERT operation
        connection.query(insertQuery, [requestData.user1, requestData.user2], (insertErr, insertResults) => {
          if (insertErr) {
            console.log("Error executing the insert query: " + insertErr);
            return res.status(500).json({ error: "Oops! Something happened :(" });
          } else {
            return res.status(200).json({ message: "User has been blocked" });
          }
        });
      }
    });
  } else {
    return res.status(400).json({ error: 'Invalid data format' });
  }
});



module.exports = router;
