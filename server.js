const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Timeframe
  max: 250, // Max requests per timeframe per ip
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (request, response, next, options) => {
    writeErrorLog(
      `Too many misc API requests`,
      `IP ${request.client._peername.address}`
    );
    return response.status(options.statusCode).send(options.message);
  },
});

// --- Reading env variables
dotenv.config({ path: "./config/config.env" });
dotenv.config({ path: "./config/secrets.env" });

// --- Setting files and locations
const storagedir = "./storage";
const logdir = "./log";
const msgFile = `${storagedir}/msg.json`;

msg = [];
if (fs.existsSync(msgFile)) {
  msg = JSON.parse(fs.readFileSync(msgFile));
}

// --- Getting the date as a nice Norwegian-time string no matter where the server runs
const dateStr = (resolution = `d`, date = false) => {
  if (!date) {
    date = new Date();
  }

  let iso = date
    .toLocaleString("en-CA", { timeZone: "Europe/Oslo", hour12: false })
    .replace(", ", "T");
  iso = iso.replace("T24", "T00");
  iso += "." + date.getMilliseconds().toString().padStart(3, "0");
  const lie = new Date(iso + "Z");
  const offset = -(lie - date) / 60 / 1000;

  if (resolution === `m`) {
    return `${new Date(date.getTime() - offset * 60 * 1000)
      .toISOString()
      .substring(0, 7)}`;
  } else if (resolution === `s`) {
    return `${new Date(date.getTime() - offset * 60 * 1000)
      .toISOString()
      .substring(0, 19)
      .replace("T", " ")}`;
  }

  return `${new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .substring(0, 10)}`;
};

const writeErrorLog = (message, error) => {
  if (!!error) {
    fs.appendFileSync(
      `${logdir}/errorlog_${dateStr(`d`)}.txt`,
      `\n${dateStr(`s`)}: ${message}\n   ${error}\n`
    );
  } else {
    fs.appendFileSync(
      `${logdir}/errorlog_${dateStr(`d`)}.txt`,
      `${dateStr(`s`)}: ${message}\n`
    );
  }
};

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));

app.use(function (req, res, next) {
  if (req.secure) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  next();
});

app.post("/", apiLimiter, async (req, res) => {
  if (req.body.token !== process.env.SP_TOKEN) {
    res.status(403).end();
  } else {
    try {
      let data = JSON.stringify(req.body.msg);
      fs.writeFileSync(msgFile, data);
      res.status(200).json(req.body.msg);
    } catch (error) {
      writeErrorLog(`Error while posting`, error);
      res.status(500).end();
    }
  }
});

app.get("/", apiLimiter, (req, res) => {
  let v = "Gitless";
  const gitfile = ".git/FETCH_HEAD";
  if (fs.existsSync(gitfile)) {
    v = fs.readFileSync(gitfile).toString().split("\t")[0];
  }

  fs.stat("./server.js", function (err, stats) {
    res.status(200).json({
      v: v,
      mtime: dateStr("s", stats.mtime),
      messages: msg,
    });
  });
});

// --- Path that Azure uses to check health, prevents 404 in the logs
app.get("/robots933456.txt", apiLimiter, (req, res) => {
  res.status(200).send("Hi, Azure");
});

// --- Serve a favicon, prevents 404 in the logs
app.use("/favicon.ico", apiLimiter, express.static("favicon.ico"));

app.listen(port, console.log(`Server now running on port ${port}`));
