import Vue from 'vue';
const path = require('path');
const fs = require('fs-extra');
const remote = require('electron').remote;
const jimp = require('jimp');

import { EventBus } from './../../event-bus.js';

const state =
{
	greenworks: null,
	steam_status: 1, // 0 = offline, 1 = online
	steam_profile:
	{
		id: null,
		name: null,
		avatar: null,
	},
	friends: [],
	app:
	{
		num_players: 0,
		build_id: null,
		build_id_experimental: null
	},
};

function convertServer(ip)
{
	ip = ip.split(':');
	return ((ip[0]>>>24)+'.'+(ip[0]>>16 & 255)+'.'+(ip[0]>>8 & 255)+'.'+(ip[0]&255))+':'+ip[1];
}
  
const mutations =
{
	setGreenworks(state, payload)
	{
		state.greenworks = payload;
	},
	setPlayers(state, payload)
	{ 
		state.num_players = payload;
	},
	setSteamStatus(state, payload)
	{
		state.steam_status = payload;
	},
	setSteamProfile(state, payload)
	{
		state.steam_profile = payload;
	},
	setFriends(state, payload)
	{
		state.friends = payload;
	},
	editFriend(state, payload)
	{
		let index = state.friends.findIndex((friend) =>
		{
			return friend.steamid == payload.steamid;
		});
		if (index > -1) Vue.set(state.friends, index, payload);
	},
	setAppBuild(state, payload)
	{
		if (payload.experimental) Vue.set(state.app, 'build_id_experimental', payload.id);
		else Vue.set(state.app, 'build_id', payload.id);
	},
	setNumOfPlayers(state, payload)
	{
		Vue.set(state.app, 'num_players', payload);
	}
}

const actions =
{
	getGreenworks(context, data)
	{
		let steamid_path = path.join(remote.app.getAppPath(), (process.env.NODE_ENV === 'development' ? '' : '/../..') + '/steam_appid.txt');
		if (!fs.existsSync(steamid_path))
		{
			fs.writeFileSync(steamid_path, context.rootState.config.appid, 'utf8');
			this._vm.$log.info(`${steamid_path} ${fs.existsSync(steamid_path)} does not exist. File was created.`);
		}

		let greenworks = require('greenworks').default;
		let message;
		if (!greenworks.initAPI())
		{
			context.commit('setSteamStatus', 0);
			this._vm.$log.error('Error on initializing steam API.');
		}
		else
		{
			greenworks.on('steam-servers-connected', this._vm.$_.debounce(() =>
			{
				message = 'Connected to Steam servers.';
				this._vm.$log.info(message);
				context.commit('setSteamStatus', this._vm.$SteamStatus.ONLINE);
				EventBus.$emit('steam-servers-connected');
			}, 1000));
			greenworks.on('steam-servers-disconnected', this._vm.$_.debounce(() =>
			{
				if (context.state.steam_status !== this._vm.$SteamStatus.OFFLINE)
				{
					message = 'Disconnected from Steam servers.';
					this._vm.$log.info(message);
					context.commit('setSteamStatus', this._vm.$SteamStatus.OFFLINE);
					EventBus.$emit('steam-servers-disconnected');
				}
			}, 1000));
			greenworks.on('steam-server-connect-failure', this._vm.$_.debounce(() =>
			{
				if (context.state.steam_status !== this._vm.$SteamStatus.OFFLINE)
				{
					message = 'Connection failure with Steam servers.';
					this._vm.$log.info(message);
					context.commit('setSteamStatus', this._vm.$SteamStatus.OFFLINE);
					EventBus.$emit('steam-server-connect-failure');
				}
			}, 1000));
			greenworks.on('steam-shutdown', this._vm.$_.debounce(() =>
			{
				message = 'Steam shutdown.';
				this._vm.$log.info(message);
				context.commit('setSteamStatus', this._vm.$SteamStatus.OFFLINE);
				EventBus.$emit('steam-shutdown');
			}, 1000));

			greenworks.on('persona-state-change', this._vm.$_.debounce((steam_id, persona_change_flag) =>
			{
				if (persona_change_flag == greenworks.PersonaChange.Name || persona_change_flag == greenworks.PersonaChange.GameServer)
				{
					context.dispatch('getFriend', steam_id);
				}
			}, 1000));

			greenworks.on('item-downloaded', this._vm.$_.debounce((app_id, file_id, success) =>
			{
				if (app_id.toString() == context.rootState.Config.config.appid)
				{
					EventBus.$emit('item-downloaded', { file: file_id, downloaded: success });
					context.dispatch('Mods/updateMod', file_id);
				}
			}, 1000));

			let steam_id = greenworks.getSteamId();
			let handle = greenworks.getMediumFriendAvatar(steam_id.steamId);
			let buffer = greenworks.getImageRGBA(handle);
			let size = greenworks.getImageSize(handle);
			let image = new jimp({data: buffer, height: size.height, width: size.width}, (err, image) =>
			{
				image.getBase64(jimp.MIME_PNG, (err, src) =>
				{
					context.dispatch('setSteamProfile',
					{
						'id': steam_id.steamId,
						'name': steam_id.screenName,
						'avatar': src,
					});
				});
			});

			this._vm.$log.info(`Initialized Steam API. Steam ID is ${steam_id.getRawSteamID()}`);

			greenworks.getNumberOfPlayers((num_of_players) =>
			{
				context.dispatch('setNumOfPlayers', num_of_players);
			}, (err) =>
			{
				if (err) this._vm.$log.error(err); 
			});
			
			context.commit('setGreenworks', greenworks);
			context.commit('setSteamStatus', 1);
		}   
	},
	setSteamStatus(context, data)
	{
		context.commit('setSteamStatus', data);
	},
	setSteamProfile(context, data)
	{
		context.commit('setSteamProfile', data);
	},
	getFriends(context, data)
	{
		let friends_data = context.state.greenworks.getFriends(state.greenworks.FriendFlags.Immediate);
		let friends = [];
		friends_data.forEach((friend) =>
		{
			let game = friend.getGamePlayed();
			let ip = game.gameserverip;
			if (ip !== 0)
			{
				ip = convertServer(ip);
			}
			friends.push(Object.freeze({
				'steamid': friend.getRawSteamID(),
				'name': friend.getPersonaName(),
				'game': {
					'appid': game.appid,
					'gameserverip': ip,
				},
			}));
		})
		context.commit('setFriends', friends);
	},
	getFriend(context, data)
	{
		let friend = data;
		let game = friend.getGamePlayed();
		let ip = game.gameserverip;
		if (ip !== 0)
		{
			ip = convertServer(ip);
		}
		context.dispatch('editFriend',
		Object.freeze({
			'steamid': friend.getRawSteamID(),
			'name': friend.getPersonaName(),
			'game':
			{
				'appid': game.appid,
				'gameserverip': ip,
			},
		}));
	},
	editFriend(context, data)
	{
		context.commit('editFriend', data);
	},
	setAppBuild(context, data)
	{
		if (typeof data !== 'object' || typeof data.experimental == 'undefined') data = {id: data, experimental: false};
		context.commit('setAppBuild', data);
	},
	setNumOfPlayers(context, data)
	{
		context.commit('setNumOfPlayers', data);
	}
}

const getters =
{
	greenworks(state)
	{
		return state.greenworks;
	},
	steam_status(state)
	{
		return state.steam_status;
	},
	steam_profile(state)
	{
		return state.steam_profile;
	},
	friends(state)
	{
		return state.friends
	},
	app(state)
	{
		return state.app;
	},
	experimental(state)
	{
		return state.app.experimental;
	}
}

export default
{
state,
mutations,
actions,
getters
}