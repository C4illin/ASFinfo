import "dotenv/config";
import Snoowrap from "snoowrap";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
	auth: `token ${process.env.ghToken}`,
});

const creds = {
	userAgent: process.env.userAgent,
	clientId: process.env.clientId,
	clientSecret: process.env.clientSecret,
	username: process.env.RedditUsername,
	password: process.env.RedditPassword,
};

// Build Snoowrap and Snoostorm clients
const client = new Snoowrap(creds);
const BOT_START = Date.now() / 1000;

const ids = [];

const subreddits = [
	"FreeGameFindings",
	"FreeGamesForPC",
	"testingground4bots",
	"FreeGamesForSteam",
	"FreeGamesOnSteam",
	"freegames",
	"Freegamestuff",
];

function checkForPosts() {
	let delay = 20000; // 20 seconds
	// biome-ignore lint/complexity/noForEach: <explanation>
	subreddits.forEach((subreddit) => {
		client
			.getSubreddit(subreddit)
			.getNew({ limit: 5 })
			.then((posts) => {
				// biome-ignore lint/complexity/noForEach: <explanation>
				posts.forEach((post) => {
					handlePost(post);
				});
			})
			.catch(() => {
				// console.log(err)
				console.log("Error, waiting 10 minutes before trying again");
				delay = 600000; // 10 minutes
			});
	});
	setTimeout(checkForPosts, delay);
}

checkForPosts();

function handlePost(post) {
	if (!ids.includes(post.id)) {
		ids.push(post.id);
		handleMessage(post);
	}
}

function handleMessage(message) {
	let appid = null;

	if (message.created_utc < BOT_START) {
		console.log(message.url);
		return;
	}

	const urlsplit = message.url.split("/");
	if (urlsplit[2] === "store.steampowered.com") {
		appid = urlsplit[4];
	} else if (message.selftext.includes("https://store.steampowered.com/app/")) {
		appid = message.selftext
			.slice(
				message.selftext.indexOf("https://store.steampowered.com/app/") + 35,
			)
			.split("/")[0];
	} else if (urlsplit[2] === "steamdb.info") {
		appid = urlsplit[4];
	}

	if (appid != null) {
		getPackages(appid, (result) => {
			if (result[0].length > 0 || result[1].length > 0) {
				let asfmsg = "    !addlicense asf";

				if (result[0].length > 0) {
					asfmsg += " s/";
					asfmsg += result[0].join(",s/");
				}

				if (result[1].length > 0) {
					if (asfmsg.length > 23) {
						asfmsg += ",a/";
					} else {
						asfmsg += " a/";
					}
					asfmsg += result[1].join(",a/");
				}
				const idsToClaim = asfmsg;
				asfmsg += "\n";

				if (result[2]) {
					asfmsg += "There is a chance this is free DLC for a non-free game. ";
				} else if (result[3]) {
					asfmsg += "This game is currently free to play. ";
				}

				if (result[4]) {
					asfmsg += "This is perhaps not released yet. ";
				}

				asfmsg +=
					"\n\n^I'm a bot | [What is ASF](https://github.com/JustArchiNET/ArchiSteamFarm) | [Info](https://www.reddit.com/user/ASFinfo/comments/jmac24/)".replace(
						/ /gi,
						"&nbsp;",
					);
				console.log(idsToClaim);
				message.reply(asfmsg);

				// Experimental gist to keep track of free games
				octokit.gists
					.get({ gist_id: process.env.gistId })
					.then((gist) => {
						let newContent =
							`${gist.data.files["Steam Codes"].content}\n${idsToClaim.substring(20).replace(/,/g, "\n")}`.trim();
						newContent = Array.from(new Set(newContent.split("\n"))).join("\n");
						return newContent;
					})
					.then((newContent) => {
						octokit.gists.update({
							gist_id: process.env.gistId,
							files: {
								"Steam Codes": {
									content: newContent,
								},
							},
						});
					});

				// New gist limited to the 40 most recent games
				octokit.gists
					.get({ gist_id: "77a4bcb9a9a7a95e5f291badc93ec6cd" })
					.then((gist) => {
						let newContent =
							`${gist.data.files["Latest Steam Games"].content}\n${idsToClaim.substring(20).replace(/,/g, "\n")}`.trim();
						newContent = Array.from(new Set(newContent.split("\n"))).join("\n");
						const lines = newContent.split("\n");
						if (lines.length > 40) {
							newContent = lines.slice(lines.length - 40).join("\n");
						}
						return newContent;
					})
					.then((newContent) => {
						octokit.gists.update({
							gist_id: "77a4bcb9a9a7a95e5f291badc93ec6cd",
							files: {
								"Latest Steam Games": {
									content: newContent,
								},
							},
						});
					});
			}
		});
		console.log(message.url);
		console.log(appid);
	} else {
		console.log(`not processed: ${message.url}`);
	}
}

function isDLCfree(dlc, dlclist, packlist) {
	return new Promise((resolve, reject) => {
		fetch(
			`https://store.steampowered.com/api/appdetails?appids=${dlc}&filters=basic,packages`,
		)
			.then((res) => res.json())
			.then((body) => {
				const packageData = body[dlc].data.package_groups;
				if (packageData.length) {
					let counter = 0;
					// biome-ignore lint/complexity/noForEach: <explanation>
					packageData[0].subs.forEach((pack) => {
						counter++;
						if (pack.is_free_license) {
							packlist.push(pack.packageid);
							counter = 0;
						} else if (counter === packageData[0].subs.length) {
							if (body[dlc].data.is_free) {
								dlclist.push(dlc);
							}
						}
					});
				} else if (body[dlc].data.is_free) {
					dlclist.push(dlc);
				}
				resolve();
			})
			.catch((err) => {
				reject(err);
			});
	});
}

function getPackages(appid, callback) {
	fetch(
		`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,packages`,
	)
		.then((res) => res.json())
		.then((body) => {
			const packageData = body[appid].data;
			if (packageData) {
				let freePackages = [];
				let freeDLC = [];
				let paid = false;
				let permanentFree = false;
				let releaseSoon = false;
				if (packageData.type === "dlc") {
					getPackages(packageData.fullgame.appid, (result) => {
						freePackages = result[0];
						freeDLC = result[1];
						if (result[2]) {
							// This means it is a dlc for a non-free game
							paid = true;
						}
						callback([freePackages, freeDLC, paid, permanentFree]);
					});
				} else {
					if (packageData.package_groups.length > 0) {
						const packagesSubs = packageData.package_groups[0].subs;
						// biome-ignore lint/complexity/noForEach: <explanation>
						packagesSubs.forEach((pack) => {
							if (pack.is_free_license) {
								freePackages.push(pack.packageid);
							}
						});
						if (freePackages.length === 0) {
							paid = true;
						}
					} else if (packageData.is_free) {
						freeDLC.push(packageData.steam_appid);
						permanentFree = true;
					} else {
						paid = true;
					}

					// remove when fully tested
					console.log("Release date:");
					console.log(packageData?.release_date || "No release date found");
					if (packageData.release_date?.coming_soon) {
						releaseSoon = true;
					}

					const packagesDLC = packageData.dlc;
					if (packagesDLC) {
						const requests = packagesDLC.map((dlc) =>
							isDLCfree(dlc, freeDLC, freePackages),
						);
						Promise.all(requests).then(() => {
							callback([
								freePackages,
								freeDLC,
								paid,
								permanentFree,
								releaseSoon,
							]);
						});
					} else {
						callback([freePackages, freeDLC, paid, permanentFree, releaseSoon]);
					}
				}
			} else {
				return null;
			}
		})
		.catch((err) => {
			console.error(err);
		});
}

// good test appIDs
// 570, 1250870, 346110
