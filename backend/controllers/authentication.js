const jwt = require('jwt-simple')
const User = require('../models/user')
const config = require('../config')
const CryptoJS = require("crypto-js")
const RandomString = require('randomstring')

/*
* Generates a token for the user based on their ID and the secret
* 
* @param   {Object}   user
*/
function tokenForUser(user) {
  const timestamp = new Date().getTime()
  return jwt.encode({ sub: user.id, iat: timestamp }, config.secret)
}


/*
* Step 1 for signin authentication.
* User must pass in their email, and if the email is in the
* database, the system will return the user's salt and a challenge.
*
* @param   {Object}   req
* @param   {Object}   res
* @param   {Function} next
*/
exports.requestSaltAndChallenge = (req, res, next) => {
  // Grab data from body.
  const { email } = req.body

  // Search for user in database
  User.findOne({ email: email }, (err, user) => {
    if (err) {
      return next(err)
    }

    if (!user) {
      return res.status(422).send({ error: 'Could not find user' })
    }

    // Return a status 201, and send an object with
    // 1) the user's salt
    // 2) a challenge
    res.status(200).send({
      salt: user.salt,
      challenge: RandomString.generate()
    })
  })
}

/*
* Step 2 for signin authentication.
* User must pass in their email, challange, and tag.
* if the tag matches that of the one generated by the system,
* then respond with a token.
*
* @param   {Object}   req
* @param   {Object}   res
* @param   {Function} next
*/
exports.validateTag = (req, res, next) => {
  //Grab data from body
  const { email, challenge, tag } = req.body

  // Search for user in database
  User.findOne({ email: email }, (err, user) => {
    if (err) {
      return next(err)
    }

    if (!user) {
      return res.status(422).send({ error: 'Could not find user' })
    }

    // Grab user's password from the database.
    const password = user.password

    // Generate a new tag with the challenge and user passsword
    const newTag = CryptoJS.HmacSHA256(challenge, password).toString()

    // Return the response if the generate tag matches user's tag
    if (newTag === tag) {
      res.status(200).send({
        token: tokenForUser(user),
        firstname: user.firstname,
        lastname: user.lastname,
        id: user._id
      })
    } else {
      res.status(422).send({ error: 'Tags do not match' })
    }
  })
}

/*
* Signs up a new user by receiving the user's
*   1) firstname
*   2) lastname
*   3) email
*   4) password
* and saves it into the database.
*
* @param   {Object}   req
* @param   {Object}   res
* @param   {Function} next
*/
exports.signup = (req, res, next) => {
  // Get values from the request body.
  const firstname = req.body.firstname
  const lastname = req.body.lastname
  const email = req.body.email
  const password = req.body.password

  // Validate that both email and password are present.
  if (!email || !password) {
    return res.status(422).send({ error: 'You must provide email and password' })
  }

  // See if a user with the given email exists.
  User.findOne({ email: email }, (err, existingUser) => {
    if (err) {
      return next(err)
    }

    // If a user with email does exist, return an error.
    if (existingUser) {
      return res.status(422).send({ error: 'Email is in use' })
    }

    // If a user with email does NOT exist, create and save user record.
    const user = new User({
      firstname: firstname,
      lastname: lastname,
      email: email,
      password: password
    })

    user.save((err) => {
      if (err) {
        return next(err)
      }

      // Respond to request indicating the user was created.
      res.status(200).send({
        token: tokenForUser(user),
        firstname: user.firstname,
        lastname: user.lastname,
        id: user._id
      })
    })
  })
}