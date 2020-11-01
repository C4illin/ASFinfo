const creds = require("./config.json")
const Snoowrap = require("snoowrap")
const snoostorm = require("snoostorm")
const fetch = require("node-fetch")

// Build Snoowrap and Snoostorm clients
const client = new Snoowrap(creds)
const BOT_START = Date.now() / 1000

// There has to be a better way to do this
const FreeGamesForPC = new snoostorm.SubmissionStream(client, {subreddit: "FreeGamesForPC", limit: 2, pollTime: 10000})
FreeGamesForPC.on("item", (message) => {
  handleMessage(message)
})
const testingground4bots = new snoostorm.SubmissionStream(client, {subreddit: "testingground4bots", limit: 2, pollTime: 20000})
testingground4bots.on("item", (message) => {
  handleMessage(message)
})
const FreeGamesForSteam = new snoostorm.SubmissionStream(client, {subreddit: "FreeGamesForSteam", limit: 2, pollTime: 10000})
FreeGamesForSteam.on("item", (message) => {
  handleMessage(message)
})
const FreeGameFindings = new snoostorm.SubmissionStream(client, {subreddit: "FreeGameFindings", limit: 2, pollTime: 10000})
FreeGameFindings.on("item", (message) => {
  handleMessage(message)
})
const FreeGamesOnSteam = new snoostorm.SubmissionStream(client, {subreddit: "FreeGamesOnSteam", limit: 2, pollTime: 10000})
FreeGamesOnSteam.on("item", (message) => {
  handleMessage(message)
})
const freegames = new snoostorm.SubmissionStream(client, {subreddit: "freegames", limit: 2, pollTime: 10000})
freegames.on("item", (message) => {
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
  } else if (urlsplit[2] == "steamdb.info") {
    appid = (urlsplit[4])
  }

  if (appid != null) { 
    getPackages(appid, (result) => {
      if (result[0].length > 0 || result[1].length > 0) {
        let asfmsg = "    !addlicense asf"

        if (result[0].length > 0) {
          asfmsg += " s/"
          asfmsg += result[0].join(",s/")
        }

        if (result[1].length > 0) {
          if (asfmsg.length > 23) {
            asfmsg += ",a/"
          } else {
            asfmsg += " a/"
          }      
          asfmsg += result[1].join(",a/")
        }

        asfmsg += "\n"

        if (result[2]) {
          asfmsg += "There is a chance this is free DLC for a non-free game."
        } else if (result[3]) {
          asfmsg += "This is most likely permanently free."
        }

        asfmsg += "\n\n^I'm a bot | [What is ASF](https://github.com/JustArchiNET/ArchiSteamFarm) | [Info](https://www.reddit.com/user/ASFinfo/comments/jmac24/)".replace(/ /gi, "&nbsp;")
        console.log(asfmsg.slice(0, -186))
        message.reply(asfmsg)
      }
    })
    console.log(message.url)
    console.log(appid)
  } else {
    console.log("not processed: " + message.url)
  }
}

function isDLCfree(dlc, dlclist, packlist) {
  return new Promise((resolve, reject) => {
    fetch(`https://store.steampowered.com/api/appdetails?appids=${dlc}&filters=basic,packages`)
      .then(res => res.json())
      .then(body => {
        let packageData = body[dlc].data.package_groups
        if (packageData.length) {
          let counter = 0
          packageData[0].subs.forEach(pack => {
            counter++
            if (pack.is_free_license) {
              packlist.push(pack.packageid)
              counter = 0
            } else if (counter == packageData[0].subs.length) {
              if (body[dlc].data.is_free) {
                dlclist.push(dlc)
              }
            }
          })
        } else if (body[dlc].data.is_free) {
          dlclist.push(dlc)
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
      let packageData  = body[appid].data
      if (packageData) {
        let freePackages = []
        let freeDLC = []
        let paid = false
        let permanentFree = false
        if (packageData.type == "dlc") {
          getPackages(packageData.fullgame.appid, (result) => {
            freePackages = result[0]
            freeDLC = result[1]
            if (result[2]) { // This means it is a dlc for a non-free game
              paid = true
            }
            callback([freePackages, freeDLC, paid, permanentFree])
          })
        } else {
          if (packageData.package_groups.length > 0) {
            let packagesSubs = packageData.package_groups[0].subs
            packagesSubs.forEach(pack => {
              if (pack.is_free_license) {
                freePackages.push(pack.packageid)
              }
            })
            if (freePackages.length == 0) {
              paid = true
            }
          } else if (packageData.is_free) {
            freeDLC.push(packageData.steam_appid)
            permanentFree = true
          } else {
            paid = true
          }
          
          let packagesDLC = packageData.dlc
          if (packagesDLC) {
            let requests = packagesDLC.map((dlc) => isDLCfree(dlc, freeDLC, freePackages))
            Promise.all(requests).then(() => {
              callback([freePackages, freeDLC, paid, permanentFree])
            })
          } else {
            callback([freePackages, freeDLC, paid, permanentFree])
          }
        }
      } else {
        return(null)
      }
    })
    .catch(err => {throw(err)})
}

// Used to test appids manually

// good test appIDs
// 570, 1250870, 346110

// getPackages(570, (result) => {
//   // console.log(result)
//   if (result[0].length > 0 || result[1].length > 0) {
//     let asfmsg = `\`\`\`\n!addlicense asf`
//     if (result[0].length > 0) {
//       asfmsg += " s/"
//       asfmsg += result[0].join(",s/")
//     }
//     if (result[1].length > 0) {
//       if (asfmsg.length > 23) {
//         asfmsg += ",a/"
//       } else {
//         asfmsg += " a/"
//       }      
//       asfmsg += result[1].join(",a/")
//     }

//     asfmsg += "\n```\n"

//     if (result[2]) {
//       asfmsg += "This is most likely free DLC for a non-free game"
//     } else if (result[3]) {
//       asfmsg += "This is most likely permanently free"
//     }
//     asfmsg += "\n^I'm a bot | [What is ASF](https://github.com/JustArchiNET/ArchiSteamFarm) | [Contact](https://www.reddit.com/message/compose?to=ChilladeChillin)".replace(/ /gi, "&nbsp;")
//     console.log(asfmsg)
//   } 
// })