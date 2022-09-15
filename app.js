const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
app.use(express.json());

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Database Error:${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//User registration
const ValidatePasswordLength = (password) => {
  return password.length > 6;
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const selectUserQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (ValidatePasswordLength(password)) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `INSERT INTO user(name,username,password,gender)
         VALUES('${name}','${username}','${hashedPassword}','${gender}');`;
      const user = await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  }
});

// User Login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "abcdef");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authenticate jwt Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "abcdef", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

module.exports = app;
// Getting tweets from user followers latest last 4tweets
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserIdQuery = `select user_id from user where username='${username}';`;
  const userResponse = await db.get(selectUserIdQuery);
  console.log(userResponse);

  const getFollowersIdQuery = `select following_user_id from follower where follower_user_id=${userResponse.user_id};`;
  const followersIds = await db.all(getFollowersIdQuery);
  console.log(followersIds);

  const getFollowersArray = followersIds.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const getTweetsFeedQuery = `select user.username ,tweet.tweet,tweet.date_time as dateTime from user JOIN tweet on user.user_id =tweet.user_id where user.user_id in (${getFollowersArray})
  order by tweet.date_time desc limit 4;`;
  const getTweetsResponse = await db.all(getTweetsFeedQuery);
  response.send(getTweetsResponse);
});

module.exports = app;

//User following names

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserId = `select user_id from user where username='${username}';`;
  const userIdResponse = await db.get(getUserId);
  console.log(userIdResponse);

  const getUserFollowersQuery = `select following_user_id from follower where follower_user_id=${userIdResponse.user_id};`;
  const followersResponse = await db.all(getUserFollowersQuery);
  console.log(followersResponse);

  const followersArray = followersResponse.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const getFollowersNames = `select name from user where user_id in(${followersArray});`;
  const followersNamesResponse = await db.all(getFollowersNames);
  response.send(followersNamesResponse);
});

//User follows names

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserId = `select user_id from user where username='${username}';`;
  const userIdResponse = await db.get(getUserId);
  console.log(userIdResponse);

  const getUserFollowers = `select follower_user_id from follower where following_user_id=${userIdResponse.user_id};`;
  const followersOfUserResponse = await db.all(getUserFollowers);
  console.log(followersOfUserResponse);

  const followersArray = followersOfUserResponse.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  const getFollowersQuery = `select name from user where user_id in (${followersArray}); `;
  const followersResponse = await db.all(getFollowersQuery);
  response.send(followersResponse);
});

//

const getTweetData = (likesCount, repliesCount, tweetAndDate) => {
  return {
    tweet: tweetAndDate.tweet,
    likes: likesCount.likes,
    replies: repliesCount.replies,
    dateTime: tweetAndDate.dateTime,
  };
};
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const getUserId = `select user_id from user where username='${username}';`;
  const userIdResponse = await db.get(getUserId);
  console.log(userIdResponse);

  const getUserFollowersQuery = `select following_user_id from follower where follower_user_id=${userIdResponse.user_id};`;
  const followersResponse = await db.all(getUserFollowersQuery);
  console.log(followersResponse);

  const followersArray = followersResponse.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${followersArray});`;
  const tweetIdResponse = await db.all(getTweetIdsQuery);
  console.log(tweetIdResponse);

  const tweetIdArrays = tweetIdResponse.map((eachId) => {
    return eachId.tweet_id;
  });

  if (tweetIdArrays.includes(parseInt(tweetId))) {
    const getLikesCount = `select count(user_id) as likes from like where tweet_id=${tweetId};`;
    const likesResponse = await db.get(getLikesCount);

    //console.log(likesResponse);

    const getRepliesCount = `select count(user_id) as replies from reply where tweet_id=${tweetId};`;
    const repliesResponse = await db.get(getRepliesCount);

    const tweetAndDateTime = `select tweet ,date_time as dateTime from tweet where tweet_id=${tweetId};`;
    const tweetDateResponse = await db.get(tweetAndDateTime);

    response.send(
      getTweetData(likesResponse, repliesResponse, tweetDateResponse)
    );
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//GET username of like by tweet
const getLikedName = (objectItem) => {
  return {
    likes: objectItem,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserId = `select user_id from user where username='${username}';`;
    const userId = await db.get(getUserId);

    const getFollowingIds = `select following_user_id from follower where follower_user_id=${userId.user_id};`;
    const followingIds = await db.all(getFollowingIds);

    console.log(followingIds);

    const followingIdArray = followingIds.map((eachId) => {
      return eachId.following_user_id;
    });

    const getTweetIds = `select tweet_id from tweet where user_id in (${followingIdArray}); `;
    const tweetIds = await db.all(getTweetIds);

    const tweetIdArray = tweetIds.map((eachId) => {
      return eachId.tweet_id;
    });

    if (tweetIdArray.includes(parseInt(tweetId))) {
      const getUsernameLiked = `select user.username  from user join like on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const usernames = await db.all(getUsernameLiked);

      const usernamesArray = usernames.map((eachUser) => {
        return eachUser.username;
      });
      response.send(getLikedName(usernamesArray));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//Get tweet replies

const getDbNameAndReply = (objectItem) => {
  return {
    replies: objectItem,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const getUserId = `select user_id from user where username='${username}';`;
    const userId = await db.get(getUserId);

    const getFollowingIds = `select following_user_id from follower where follower_user_id=${userId.user_id};`;
    const followingIds = await db.all(getFollowingIds);

    console.log(followingIds);

    const followingIdArray = followingIds.map((eachId) => {
      return eachId.following_user_id;
    });

    const getTweetIds = `select tweet_id from tweet where user_id in (${followingIdArray}); `;
    const tweetIds = await db.all(getTweetIds);

    const tweetIdArray = tweetIds.map((eachId) => {
      return eachId.tweet_id;
    });

    if (tweetIdArray.includes(parseInt(tweetId))) {
      const getNameAndReply = `select  user.name, reply.reply from user join reply on user.user_id =reply.user_id where reply.tweet_id=${tweetId};`;
      const nameAndReply = await db.all(getNameAndReply);
      response.send(getDbNameAndReply(nameAndReply));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//GET all tweets from user

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const userIdResponse = await db.get(getUserIdQuery);

  console.log(userIdResponse);

  const getTweetIdsQuery = `select tweet_id from tweet where user_id=${userIdResponse.user_id};`;
  const tweetIdsResponse = await db.all(getTweetIdsQuery);
  console.log(tweetIdsResponse);

  const tweetIdArray = tweetIdsResponse.map((eachId) => {
    return eachId.tweet_id;
  });
  console.log(tweetIdArray);

  const getTweetQuery = `select tweet.tweet,count(like.user_id) as likes,count(reply.user_id) as replies,date_time as dateTime from (tweet join reply on tweet.user_id = reply.user_id)As T join like on T.user_id=like.user_id where tweet.tweet_id IN (${tweetIdArray});`;
  const tweetData = await db.all(getTweetQuery);
  response.send(tweetData);

  //   const getTweets = `select tweet from tweet where tweet_id in(${tweetIdArray});`;
  //   const tweets = await db.all(getTweets);
  //   console.log(tweets);
  //   response.send(tweets);
});

//Create A tweet

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserId = `select user_id from user where username='${username}';`;
  const userId = await db.get(getUserId);

  const { tweet } = request.body;
  const todayDateTime = new Date();

  const createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES('${tweet}',${userId.user_id},'${todayDateTime}');`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//DELETE tweet

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getUserId = `select user_id from user where username='${username}' ;`;
    const userId = await db.get(getUserId);

    const getTweetIdsQuery = `select tweet_id from tweet where user_id=${userId.user_id};`;
    const tweetIds = await db.all(getTweetIdsQuery);
    console.log(tweetIds);

    const tweetIdArray = tweetIds.map((eachId) => {
      return eachId.tweet_id;
    });
    if (tweetIdArray.includes(parseInt(tweetId))) {
      const deleteTweet = `delete from tweet where tweet_id =${tweetId};`;
      await db.run(deleteTweet);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
