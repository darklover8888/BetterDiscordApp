/**
 * BetterDiscord Channel Struct
 * Copyright (c) 2015-present Jiiks/JsSucks - https://github.com/Jiiks / https://github.com/JsSucks
 * All rights reserved.
 * https://betterdiscord.net
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
*/

import { DiscordApi, DiscordApiModules as Modules } from 'modules';
import { List, InsufficientPermissions } from 'structs';
import { Guild } from './guild';
import { Message } from './message';
import { User, GuildMember } from './user';

const channels = new WeakMap();

export class Channel {

    constructor(data) {
        if (channels.has(data)) return channels.get(data);
        channels.set(data, this);

        this.discordObject = data;
    }

    static from(channel) {
        switch (channel.type) {
            default: return new Channel(channel);
            case 0: return new GuildTextChannel(channel);
            case 1: return new DirectMessageChannel(channel);
            case 2: return new GuildVoiceChannel(channel);
            case 3: return new GroupChannel(channel);
            case 4: return new ChannelCategory(channel);
        }
    }

    static fromId(id) {
        const channel = Modules.ChannelStore.getChannel(id);
        if (channel) return Channel.from(channel);
    }

    static get GuildChannel() { return GuildChannel }
    static get GuildTextChannel() { return GuildTextChannel }
    static get GuildVoiceChannel() { return GuildVoiceChannel }
    static get ChannelCategory() { return ChannelCategory }
    static get PrivateChannel() { return PrivateChannel }
    static get DirectMessageChannel() { return DirectMessageChannel }
    static get GroupChannel() { return GroupChannel }

    get id() { return this.discordObject.id }
    get applicationId() { return this.discordObject.application_id }
    get type() { return this.discordObject.type }
    get name() { return this.discordObject.name }

    /**
     * Send a message in this channel.
     * @param {String} content The new message's content
     * @param {Boolean} parse Whether to parse the message or send it as it is
     * @return {Promise}
     */
    async sendMessage(content, parse = false) {
        if (this.assertPermissions) this.assertPermissions('SEND_MESSAGES', Modules.DiscordPermissions.VIEW_CHANNEL | Modules.DiscordPermissions.SEND_MESSAGES);

        if (parse) content = Modules.MessageParser.parse(this.discordObject, content);
        else content = {content};

        const response = await Modules.MessageActions._sendMessage(this.id, content);
        return Message.from(Modules.MessageStore.getMessage(this.id, response.body.id));
    }

    /**
     * Send a bot message in this channel that only the current user can see.
     * @param {String} content The new message's content
     * @return {Message}
     */
    sendBotMessage(content) {
        const message = Modules.MessageParser.createBotMessage(this.id, content);
        Modules.MessageActions.receiveMessage(this.id, message);
        return Message.from(Modules.MessageStore.getMessage(this.id, message.id));
    }

    /**
     * A list of messages in this channel.
     */
    get messages() {
        const messages = Modules.MessageStore.getMessages(this.id).toArray();
        return List.from(messages, m => Message.from(m));
    }

    /**
     * Jumps to the latest message in this channel.
     */
    jumpToPresent() {
        if (this.assertPermissions) this.assertPermissions('VIEW_CHANNEL', Modules.DiscordPermissions.VIEW_CHANNEL);
        if (this.hasMoreAfter) Modules.MessageActions.jumpToPresent(this.id, Modules.DiscordConstants.MAX_MESSAGES_PER_CHANNEL);
        else this.messages[this.messages.length - 1].jumpTo(false);
    }

    get hasMoreAfter() {
        return Modules.MessageStore.getMessages(this.id).hasMoreAfter;
    }

    /**
     * Sends an invite in this channel.
     * @param {String} code The invite code
     * @return {Promise}
     */
    async sendInvite(code) {
        if (this.assertPermissions) this.assertPermissions('SEND_MESSAGES', Modules.DiscordPermissions.VIEW_CHANNEL | Modules.DiscordPermissions.SEND_MESSAGES);
        const response = Modules.MessageActions.sendInvite(this.id, code);
        return Message.from(Modules.MessageStore.getMessage(this.id, response.body.id));
    }

    /**
     * Opens this channel in the UI.
     */
    select() {
        if (this.assertPermissions) this.assertPermissions('VIEW_CHANNEL', Modules.DiscordPermissions.VIEW_CHANNEL);
        Modules.NavigationUtils.transitionToGuild(this.guildId ? this.guildId : Modules.DiscordConstants.ME, this.id);
    }

    /**
     * Whether this channel is currently selected.
     */
    get isSelected() {
        return DiscordApi.currentChannel === this;
    }

    /**
     * Opens this channel's settings window.
     * @param {String} section The section to open (see DiscordConstants.ChannelSettingsSections)
     */
    openSettings(section = 'OVERVIEW') {
        Modules.ChannelSettingsWindow.setSection(section);
        Modules.ChannelSettingsWindow.open(this.id);
    }

}

export class PermissionOverwrite {
    constructor(data, channel_id) {
        this.discordObject = data;
        this.channelId = channel_id;
    }

    static from(data, channel_id) {
        switch (data.type) {
            default: return new PermissionOverwrite(data, channel_id);
            case 'role': return new RolePermissionOverwrite(data, channel_id);
            case 'member': return new MemberPermissionOverwrite(data, channel_id);
        }
    }

    static get RolePermissionOverwrite() { return RolePermissionOverwrite }
    static get MemberPermissionOverwrite() { return MemberPermissionOverwrite }

    get type() { return this.discordObject.type }
    get allow() { return this.discordObject.allow }
    get deny() { return this.discordObject.deny }

    get channel() {
        return Channel.fromId(this.channelId);
    }

    get guild() {
        if (this.channel) return this.channel.guild;
    }
}

export class RolePermissionOverwrite extends PermissionOverwrite {
    get roleId() { return this.discordObject.id }

    get role() {
        if (this.guild) return this.guild.roles.find(r => r.id === this.roleId);
    }
}

export class MemberPermissionOverwrite extends PermissionOverwrite {
    get memberId() { return this.discordObject.id }

    get member() {
        return GuildMember.fromId(this.memberId);
    }
}

export class GuildChannel extends Channel {
    static get PermissionOverwrite() { return PermissionOverwrite }

    get guildId() { return this.discordObject.guild_id }
    get parentId() { return this.discordObject.parent_id } // Channel category
    get position() { return this.discordObject.position }
    get nicks() { return this.discordObject.nicks }

    checkPermissions(perms) {
        return Modules.PermissionUtils.can(perms, DiscordApi.currentUser, this.discordObject);
    }

    assertPermissions(name, perms) {
        if (!this.checkPermissions(perms)) throw new InsufficientPermissions(name);
    }

    get category() {
        return Channel.fromId(this.parentId);
    }

    /**
     * The current user's permissions on this channel.
     */
    get permissions() {
        return Modules.GuildPermissions.getChannelPermissions(this.id);
    }

    get permissionOverwrites() {
        return List.from(Object.entries(this.discordObject.permissionOverwrites), ([i, p]) => PermissionOverwrite.from(p, this.id));
    }

    get guild() {
        return Guild.fromId(this.guildId);
    }

    /**
     * Whether this channel is the guild's default channel.
     */
    get defaultChannel() {
        return Modules.GuildChannelsStore.getDefaultChannel(this.guildId).id === this.id;
    }
}

// Type 0 - GUILD_TEXT
export class GuildTextChannel extends GuildChannel {
    get type() { return 'GUILD_TEXT' }
    get topic() { return this.discordObject.topic }
    get nsfw() { return this.discordObject.nsfw }
}

// Type 2 - GUILD_VOICE
export class GuildVoiceChannel extends GuildChannel {
    get type() { return 'GUILD_VOICE' }
    get userLimit() { return this.discordObject.userLimit }
    get bitrate() { return this.discordObject.bitrate }

    sendMessage() { throw new Error('Cannot send messages in a voice channel.'); }
    get messages() { return []; }
    jumpToPresent() { throw new Error('Cannot select a voice channel.'); }
    get hasMoreAfter() { return false; }
    sendInvite() { throw new Error('Cannot invite someone to a voice channel.'); }
    select() { throw new Error('Cannot select a voice channel.'); }
}

// Type 4 - GUILD_CATEGORY
export class ChannelCategory extends GuildChannel {
    get type() { return 'GUILD_CATEGORY' }
    get parentId() { return undefined }
    get category() { return undefined }

    sendMessage() { throw new Error('Cannot send messages in a channel category.'); }
    get messages() { return []; }
    jumpToPresent() { throw new Error('Cannot select a channel category.'); }
    get hasMoreAfter() { return false; }
    sendInvite() { throw new Error('Cannot invite someone to a channel category.'); }
    select() { throw new Error('Cannot select a channel category.'); }

    /**
     * A list of channels in this category.
     */
    get channels() {
        return List.from(this.guild.channels, c => c.parentId === this.id);
    }
}

export class PrivateChannel extends Channel {
    get userLimit() { return this.discordObject.userLimit }
    get bitrate() { return this.discordObject.bitrate }
}

// Type 1 - DM
export class DirectMessageChannel extends PrivateChannel {
    get type() { return 'DM' }
    get recipientId() { return this.discordObject.recipients[0] }

    /**
     * The other user of this direct message channel.
     */
    get recipient() {
        return User.fromId(this.recipientId);
    }
}

// Type 3 - GROUP_DM
export class GroupChannel extends PrivateChannel {
    get ownerId() { return this.discordObject.ownerId }
    get type() { return 'GROUP_DM' }
    get icon() { return this.discordObject.icon }

    /**
     * A list of the other members of this group direct message channel.
     */
    get members() {
        return List.from(this.discordObject.recipients, id => User.fromId(id));
    }

    /**
     * The owner of this group direct message channel. This is usually the person who created it.
     */
    get owner() {
        return User.fromId(this.ownerId);
    }
}