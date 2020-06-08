import Vue from 'vue';
import axios from 'axios';
const request = require('request');
const moment = require('moment');
axios.interceptors.response.use(res =>
{
    log.info(`[${res.config.method.toUpperCase()}] ${res.config.url} ${res.status} ${res.statusText}`);
    return res;
});
const log = require('electron').remote.getGlobal('log');

const state =
{
    servers: [],
    playing_server: null,
    playing_offline: false,
    highlighted_server: {},
    last_update: null,
    filters:
    {
        search: '',
        bool:
        {
            first_person:
            {
                label: 'First person',
                options: [{label: 'Any', value: null}, {label: 'Yes', value: true}, {label: 'No', value: false}],
                selected: {label: 'Any', value: null},
                value: false,
            },
            vanilla:
            {
                label: 'Vanilla',
                options: [{label: 'Any', value: null}, {label: 'Yes', value: true}, {label: 'No', value: false}],
                selected: {label: 'Any', value: null},
                value: false,
            },
            friends_playing:
            {
                label: 'Friends playing',
                options: [{label: 'Any', value: null}, {label: 'Yes', value: true}, {label: 'No', value: false}],
                selected: {label: 'Any', value: null},
                value: false,
            },
        },
        list:
        {
            map:
            {
                label: 'Map',
                options: [],
                selected: {label: 'Any', value: null},
            },
            mods:
            {
                label: 'Mods',
                options: [],
                selected: [],
            },
        },
    },
};
  
const mutations =
{
    setServers(state, data)
    {
        state.servers = data;
    },
    setServer(state, data)
    {
        if (typeof data.find !== 'undefined' && data.find)
        {
            Vue.set(state.servers, find, data.server);
        }
        else
        {
            state.servers.push(data.server);
        }
    },
    setServerMods(state, data)
    {
        Vue.set(state.servers[data.find], 'mods', data.mods);
    },
    editServerPing(state, data)
    {
        let find = state.servers.findIndex((server) =>
        {
            return server.name == data.server.name;
        });
        if (find)
        {
            Vue.set(state.servers[find], 'ping', data.ping);
        }
    },
    setSearch(state, data)
    {
        state.filters.search = data;
    },
    setFilters(state, data)
    {
        state.filters = data;
    },
    setFilterValue(state, data)
    {
        Vue.set(state.filters[data.type][data.key], 'value', data.value);
    },
    setFilterSelected(state, data)
    {
        Vue.set(state.filters[data.type][data.key], 'selected', data.value);
    },
    setFilterOptions(state, data)
    {
        Vue.set(state.filters[data.type][data.key], 'options', data.options);
    },
    setLastUpdate(state, data)
    {
        state.last_update = data;
    },
    setPlayingServer(state, data)
    {
        state.playing_server = data;
    },
    setHighlightedServer(state, data)
    {
        state.highlighted_server = data;
    },
    setPlayingOffline(state, data)
    {
        state.playing_offline = data;
    }
}

const actions = {
    getServers(context, data)
    {
        axios.get(`https://api.dayzmagiclauncher.com/servers`).then(res =>
        {
            context.commit('setServers', res.data.body);
            context.dispatch('setLastUpdate', res.data.last_updated);
            context.dispatch('editLoaded', {type: 'servers', value: true}, { root: true });
        }).catch(err =>
        {
            log.error(err);
        });
    },
    getServer(context, data)
    {
        axios.get(`https://api.dayzmagiclauncher.com/servers/${data.ip }:${data.query_port}`).then(res =>
        {
            let find = state.servers.findIndex((server) =>
            {
                return server.hasOwnProperty('ip') && server.ip == data.ip && server.game_port == data.game_port;                
            });
            context.commit('setServer', {find: find,server: body.body});
        }).catch(err =>
        {
            log.error(err);
        });
    },
    setServerMods(context, data)
    {
        let find = state.servers.findIndex((server) =>
        {
            return server.ip == data.ip && server.game_port == data.game_port;                
        });
        if (typeof find !== 'undefined' && find)
        {
            data.find = find;
            context.commit('setServerMods', data);
        }
    },
    pingServer(context, data)
    {
        context.commit('editServerPing', data);
    },
    setSearch(context, data)
    {
        context.commit('setSearch', data);
    },
    setFilters(context, data)
    {
        context.commit('setFilters', data);
    },
    setFilterSelected(context, data)
    {
        let options = context.state.filters;
        let type;
        Object.keys(options).some((filter) =>
        {
            type = Object.keys(options[filter]).find((key) =>
            {
                return key == data.key;
            }) ? filter : null;
            return type !== null;
        });
        data.type = type;
        context.commit('setFilterSelected', data);
    },
    setFilterValue(context, data)
    {
        let options = context.state.filters;
        let type;
        Object.keys(options).some((filter) =>
        {
            type = Object.keys(options[filter]).find((key) =>
            {
                return key == data.key;
            }) ? filter : null;
            return type !== null;
        });
        data.type = type;
        context.commit('setFilterValue', data);
    },
    setFilterOptions(context, data)
    {
        let options = context.state.filters;
        let type;
        Object.keys(options).forEach((filter) =>
        {
            type = Object.keys(options[filter]).find((key) =>
            {
                return key == data.key;
            }) ? filter : null;
        });
        data.type = type;
        context.commit('setFilterOptions', data);
    },
    setLastUpdate(context, data)
    {
        context.commit('setLastUpdate', data);
    },
    setHighlightedServer(context, data)
    {
        context.commit('setHighlightedServer', data);
    },
    setPlayingServer(context, data)
    {
        context.commit('setPlayingServer', data);
    },
    setPlayingOffline(context, data)
    {
        context.commit('setPlayingOffline', data);
    }
}

const getters =
{
    servers(state)
    {
        return state.servers;
    },
    filters(state)
    {
        return state.filters;
    },
    last_update(state)
    {
        return state.last_update;
    },
    playing_server(state)
    {
        return state.playing_server;
    },
    highlighted_server(state)
    {
        return state.highlighted_server;
    },
    playing_offline(state)
    {
        return state.playing_offline;
    }
}

export default
{
namespaced: true,
state,
mutations,
actions,
getters
}