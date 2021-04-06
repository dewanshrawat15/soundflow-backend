# SoundFlow Backend
Server for the web app music player

## Setting up

### Installing and setting up MongoDB
- Install MongoDB Community edition
- Start mongodb as a service
- Install MongoDB Compass

### Installing project dependencies
- Run ```yarn``` or ```npm install```
- Run ```yarn start``` or ```npm run start``` to run this project.
- Add a ```.env``` file, with a ```MONGO_URI``` variable specifying the mongodb URL, and assign the ```TOKEN_SECRET``` variable a value similar to the key hash generated by ```crypto.randomBytes(128).toString('hex')```.

## Database schema

- User table schema
```
  username: {type: String, required: true},
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  hash: {type: String, required: true},
  salt: {type: String, required: true}
```
- AuthToken table schema
```
  authToken: {type: String, required: true},
  username: {type: String, required: true}
```

## API Endpoints

#### ```/users/all```

##### GET Request
An API endpoint to fetch all users

#### ```/users/create```

##### POST Request
An API endpoint that creates a new entry in the users table and an entry in the auth token table for the user.

#### ```/users/delete/all```

##### GET Request
An API endpoint that deletes all users and auth tokens from the users table and the auth token tables.

#### ```/users/login```

##### POST Request
An API endpoint to authenticate a user, and return an auth token corresponding to the user.

#### ```/users/password/update```

##### POST Request
An API endpoint to update password for a user.