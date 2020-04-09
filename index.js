const creds = require("./config.json")
const Snoowrap = require("snoowrap")
const snoostorm = require("snoostorm")
const fetch = require('node-fetch')

// Build Snoowrap and Snoostorm clients
const client = new Snoowrap(creds)
const BOT_START = Date.now() / 1000

//testingground4bots
const submissions = new snoostorm.SubmissionStream(client, { subreddit: "FreeGameFindings", limit: 10, pollTime: 2000 })
submissions.on("item", (message) => {
  if(message.created_utc < BOT_START) return
  let urlsplit = message.url.split("/")
  if (urlsplit[2] == "store.steampowered.com") {
    getPackages(urlsplit[4], (result) => {
      if (result[0].length > 0) {
        let asfmsg = `\`\`\`\n!addlicense asf ${result[0].join(" ")}\n\`\`\``
        if (result[1].length > 0) {
          asfmsg += `\nFree dlc appID:  ${result[1].join(" ")}`
        }
        asfmsg += "\n\n^I'm a bot | [What is ASF](https://github.com/JustArchiNET/ArchiSteamFarm) | [Contact](https://www.reddit.com/message/compose?to=ChilladeChillin)".replace(/ /gi, "&nbsp;")
        console.log(asfmsg)
        message.reply(asfmsg)
      }
    })
  }
  console.log(message.url)
})

const inbox = new snoostorm.InboxStream(client)
inbox.on("item", console.log)
inbox.end()
inbox.on("end", () => console.log("And now my watch has ended"))

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