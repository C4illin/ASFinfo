const creds = require("./config.json")
const Snoowrap = require("snoowrap")
const snoostorm = require("snoostorm")
const fetch = require("node-fetch")

// Build Snoowrap and Snoostorm clients
const client = new Snoowrap(creds)
const BOT_START = Date.now() / 1000

// There has to be a better way to do this
const FreeGamesForPC = new snoostorm.SubmissionStream(client, {subreddit: "FreeGamesForPC", limit: 2, pollTime: 5000})
FreeGamesForPC.on("item", (message) => {
  handleMessage(message)
})
const testingground4bots = new snoostorm.SubmissionStream(client, {subreddit: "testingground4bots", limit: 1, pollTime: 10000})
testingground4bots.on("item", (message) => {
  handleMessage(message)
})
const FreeGamesForSteam = new snoostorm.SubmissionStream(client, {subreddit: "FreeGamesForSteam", limit: 2, pollTime: 5000})
FreeGamesForSteam.on("item", (message) => {
  handleMessage(message)
})
const FreeGameFindings = new snoostorm.SubmissionStream(client, {subreddit: "FreeGameFindings", limit: 2, pollTime: 5000})
FreeGameFindings.on("item", (message) => {
  handleMessage(message)
})

function handleMessage(message) {
  let appid = null

  if(message.created_utc < BOT_START) {
    console.log(message.url)
    return
  }

  let urlsplit = message.url.split("/")
  if (urlsplit[2] == "store.steampowered.com") {
    appid = (urlsplit[4])
  } else if (message.selftext.includes("https://store.steampowered.com/app/")) {
    appid = message.selftext.slice(message.selftext.indexOf("https://store.steampowered.com/app/")+35).split("/")[0]
  }

  if (appid != null) {
    getPackages(appid, (result) => {
      if (result[0].length > 0) {
        let asfmsg = `\`\`\`\n!addlicense asf ${result[0].join(" ")}\n\`\`\``
        if (result[1].length > 0) {
          asfmsg += "\nFree DLC (couldn't find packageID):"
          result[1].forEach(elem => {
            asfmsg += ` [${elem}](https://store.steampowered.com/app/${elem})`
          })
        }
        asfmsg += "\n\n^I'm a bot | [What is ASF](https://github.com/JustArchiNET/ArchiSteamFarm) | [Contact](https://www.reddit.com/message/compose?to=ChilladeChillin)".replace(/ /gi, "&nbsp;")
        console.log(asfmsg.slice(0, -187))
        message.reply(asfmsg)
      } 
    })
    console.log(message.url)
    console.log(appid)
  } else {
    console.log("not processed: " + message.url)
  }
}

function isDLCfree(dlc, list) {
  return new Promise((resolve, reject) => {
    fetch(`https://store.steampowered.com/api/appdetails?appids=${dlc}&filters=basic`)
      .then(res => res.json())
      .then(body => {
        if (body[dlc].data.is_free) {
          list.push(dlc)
        }
        resolve()
      })
      .catch(err => {
        reject(err)
      })
  })
}

function getPackages(appid, callback) {
  fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,packages`)
    .then(res => res.json())
    .then(body => {
      let freePackages = []
      let freeDLC = []
      let packageData  = body[appid].data
      if (packageData) {
        let packagesSubs = packageData.package_groups[0].subs
        packagesSubs.forEach(pack => {
          if (pack.is_free_license) {
            freePackages.push(pack.packageid)
          }
        })
        let packagesDLC = packageData.dlc
        if (packagesDLC) {
          let requests = packagesDLC.map((dlc) => isDLCfree(dlc, freeDLC))
          Promise.all(requests).then(() => {
            callback([freePackages, freeDLC])
          })
        } else {
          callback([freePackages, freeDLC])
        }
      } else {
        return(null)
      }
    })
    .catch(err => {throw(err)})
}

// getPackages("1135570", (result) => { //urlsplit[4]
//   if (result != []) {
//     let asfmsg = "!addlicense asf "+result.join(" ")
//     console.log(asfmsg)
//     // message.reply()
//   }
// })