const express = require("express");
const bodyParser = require('body-parser');
const app = express();
var uname="yg" , pwd="kjh";
const mysql = require("mysql");
var AWS = require('aws-sdk');
const session = require("express-session");
const upload = require("express-fileupload")


app.use(upload());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: "secret"
}))

var iam = new AWS.IAM({
    accessKeyId: "AKIA45C6FDZJGH662JST",
    secretAccessKey: "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"
});

var s3 = new AWS.S3({
    accessKeyId: "AKIA45C6FDZJGH662JST",
    secretAccessKey: "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"
  });

var mysqlConnection =  mysql.createConnection({
    host : "localhost",
    user : "root",
    password : "",
    database : "iam"
});


app.use(bodyParser.urlencoded({
    extended:true
}));
 
app.get("/reg", function(req, res) {
  res.sendFile(__dirname + "/reg.html");
});

app.post("/register",function(req,res){
uname = req.body.name;
pwd = req.body.password;    
console.log(uname +" "+pwd);


    

    console.log('Inserted');
    var params = {
        Bucket: uname,
        ACL: "private",
       };
       s3.createBucket(params, function(err, data) {
         if (err) console.log(err, err.stack); // an error occurred
         else     console.log(data);           // successful response
       });
    

    // create IAM user
    var params1 = {
      UserName: uname
     };
     iam.createUser(params1, function(err, data) {
       if (err) console.log(err, err.stack); // an error occurred
       else     console.log(data);           // successful response
     


     //insert the IAM user
     var params2 = {
      UserName: uname
     };
     iam.createAccessKey(params2, function(err, data) {
       if (err) console.log(err, err.stack); // an error occurred
       else     {
         console.log(data.AccessKey.AccessKeyId);
         console.log(data.AccessKey.SecretAccessKey);
         mysqlConnection.query("insert into users (uname,pwd,a_key,s_key) values ('"+uname+"','"+pwd+"','"+data.AccessKey.AccessKeyId+"','"+data.AccessKey.SecretAccessKey+"')",function(err,result){
          if(err)
          {
              console.log(err);
          }
          else {
            console.log('Keys inserted');
            //Attaching Policy
            var policy = '{ "Version": "2012-10-17", "Statement": [ {  "Action": "s3:*", "Effect": "Allow", "Resource": "arn:aws:s3:::'+uname+'/*" } ] }';
            var params = {
              PolicyDocument: policy,
              PolicyName: uname, 
          
            };
            iam.createPolicy(params, function(err, data) {
              if (err) console.log(err, err.stack); 
              else    { console.log(data);
                        //Attach Policy
                        var arn = data.Policy.Arn;
                        var params = {
                          PolicyArn: arn, 
                          UserName: uname
                         };
                         iam.attachUserPolicy(params, function(err, data) {
                           if (err) console.log(err, err.stack); // an error occurred
                           else     {console.log("policy attached"); res.redirect('/log')};           // successful response
                         });

                         }           
            });
        }
        }
          );
        
      };          
     }); });


});

app.get("/log", function(req, res) {
  
  res.sendFile(__dirname + "/loginn.html");
});

app.get("/",function(req,res){
  console.log("in");
  res.sendFile((__dirname + "/home.html"));
});

app.post("/login",function(req, res){
  
  check_uname = req.body.name;
  check_pwd = req.body.password;
  mysqlConnection.query("select * from users where uname = '"+check_uname+"'",function(err,result){
    if(err){
      console.log(err);
    }
    else{
      if(result[0].pwd==check_pwd){
        console.log('logged in');
        req.session.user= check_uname;
        req.session.save();
        res.redirect("/dashboard");
      }
      else{
        console.log('wrong pwd');
      }
    }
  });

});


app.get("/dashboard",function(req,res){
  //res.write(req.session.user);
  res.sendFile(__dirname+"/dashboard.html");
});

app.get("/logout",function(req,res){
  req.session.destroy();
  res.send("<html><body><center><h1>You are logged out!</h1><div id='b'><a href='/log'>Login</a> ");
});

app.post("/uploads",function(req,res){
  if(req.files){
    toAWS(req.files.upfile.data,req.session.user,req.files.upfile.name,res);
  }
}

);




function toAWS(data,uname,fname,res)
{
  mysqlConnection.query("select * from users where uname = '"+uname+"'",function(err,result){
    if(err){
      console.log(err);
    }
    else{
      var keys = [
        result[0].a_key,
        result[0].s_key
      ]
    
  console.log(keys);
  console.log(data);

  var bucket = new AWS.S3({
    accessKeyId: keys[0],
    secretAccessKey: keys[1]
  });
  var sup =  new Buffer(data, 'binary').toString('base64');
  var bparam ={
    Bucket: uname, 
    Key: fname,
    Body: data
   };
   bucket.putObject(bparam, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else   {  console.log(data);
      //res.send('file uploaded');
      res.redirect("/getfiles");
               } 
  });
    }
})
}

app.listen(3000, function(){
    console.log("server is running on port 3000");
  })



app.get('/getfiles',function(req,res){
  var params = {
    Bucket: req.session.user, 
    MaxKeys: 100
   };
   s3.listObjects(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     {
      
     console.log(data.Contents.length);
     res.write(`<html><link rel='stylesheet' href='getfiles_s.css'><style type="text/css">
     button
     {
       text-align: right;
       padding: 6px;
       border-radius: 4px;
     }	
     </style><body><button><a href="/dashboard">DASHBOARD</a></button>
     <button><a href="/getfiles">GET FILES</a></button><h2> Here are your list of files!</h2><br><table><tr><th>File Index</th><th>Files</th></tr>`);
     for (var i=0;i<data.Contents.length;i++)
     {
       res.write("<tr><td>File-"+(i+1)+"</td><td><a href='/getfile?name="+data.Contents[i].Key+"'>"+data.Contents[i].Key+"</a></td></tr>");
     }
     res.end();
   }  
})
})


app.get('/getfile',function( req,res){
  var file = req.query.name;
  var resp = `<!DOCTYPE html>
  <html>
  <head>	
  <link rel="stylesheet" href="action_s.css">	
  <title>File action ${file}</title>
  </head>
  <body>
  
  <div id='b'><a href='/dashboard'>Dashboard</a>
  &nbsp <a href='/getfiles'>Get Files</a> </div>
  <h1>You chose the file <i>${file}</i>, Choose your action!</h1>
  <button><a href="/delete?name=${file}">Delete</a></button>
  <button><a href="/share?name=${file}">share</a></button>
  <button><a href="/viewfile?name=${file}">view/download</a></button>
  </body>
  </html>
  `;
  res.send(resp);
});


app.get('/viewfile',function(req,res){
  var file = req.query.name;
  uname = req.session.user;
  mysqlConnection.query("select * from users where uname = '"+uname+"'",function(err,result){
    if(err){
      console.log(err);
    }
    else{
      var keys = [
        result[0].a_key,
        result[0].s_key
      ]
    
  console.log(keys);
 //console.log(data);

  var bucket = new AWS.S3({
    accessKeyId: keys[0],
    secretAccessKey: keys[1]
  });

  var paramst = {
    Bucket: uname, 
  Key: file
}

bucket.getObject(paramst, function(err, data) {
  console.log(data);
  //res.writeHead(200, {'Content-Type': 'image/jpeg'});
  res.write(data.Body, 'binary');
  res.end(null, 'binary');
});


}})
}

)


app.get('/delete',function(req,res){
  var file = req.query.name;
  uname = req.session.user;
  mysqlConnection.query("select * from users where uname = '"+uname+"'",function(err,result){
    if(err){
      console.log(err);
    }
    else{
      var keys = [
        result[0].a_key,
        result[0].s_key
      ]
    
  console.log(keys);
 //console.log(data);

  var bucket = new AWS.S3({
    accessKeyId: keys[0],
    secretAccessKey: keys[1]
  });

  var paramst = {
    Bucket: uname, 
  Key: file
}

bucket.deleteObject(paramst, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     {console.log(data);
    res.redirect("/getfiles");}           // successful response
  /*
  data = {
  }
  */
});


}})
})


app.get("/share",function(req,res){
  var file = req.query.name;
  uname = req.session.user;
  var vvaa = `<!DOCTYPE html>
  <html>
  <head>
    <title>Share File</title>
    <link rel="stylesheet" href="share_s.css"> 
  </head>
  <h2>You chose the file - <i>${file}</i></h2>
  <body>
  <form action="/share" method="POST">
    <label>Enter the username to share with:</label><input type="text" name="sharename" placeholder="USERNAME">
    <input type="hidden" name="file" value="${file}">
    <button>Submit</button>
  </form>
  </body>
  </html>`;
  res.send(vvaa);
})

app.post("/share",function(req,res){
  var file = req.body.file;
  var sharename = req.body.sharename;  
  console.log(file+" "+sharename+" "+req.session.user)

  var paramsp = {
    Bucket: req.session.user, 
  Key: file
}

s3.getObject(paramsp, function(err, data) {
  var paramsp2 = {
    Bucket: sharename, 
    Body: data.Body,
    Key: file
   };
   s3.putObject(paramsp2, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     {console.log(data);res.send("<html><body><center><h1>Shared Succefully Shared</h1></center>");};           // successful response
  });
});
})


app.get('/dashboard_s.css',function(req,res){
  res.sendFile(__dirname + "/dashboard_s.css");
})

app.get('/action_s.css',function(req,res){
  res.sendFile(__dirname + "/action_s.css");
})

app.get('/getfiles_s.css',function(req,res){
  res.sendFile(__dirname + "/getfiles_s.css");
})


app.get('/login_c.css',function(req,res){
  res.sendFile(__dirname + "/login_c.css");
});


app.get('/share_s.css',function(req,res){
res.sendFile(__dirname + "/share_s.css");
})