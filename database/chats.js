const database = require('../databaseConnection');

async function getAllChats(postData) {
    let getChatsSQL = `
        select r.room_id "id", r.name "name", ru.last_message_read_id "last_msg"
        from user u
        left join room_user ru
        on u.user_id = ru.user_id
        left join room r
        on ru.room_id = r.room_id
        where u.user_id = :user_id;
    `;

    let getLatestMessageIDSQL = `
        select max(m.message_id) "max_msg"
        from message m
        left join room_user ru
        on m.room_user_id = ru.room_user_id
        left join room r
        on ru.room_id = r.room_id
        where r.room_id = :room_id;
    `;

    let getUnreadMessagesSQL = `
        select count(m.message_id) "unread"
        from message m
        left join room_user ru
        on m.room_user_id = ru.room_user_id
        where
            m.message_id > :last_msg
            and
            m.message_id <= :max_msg
            and
            ru.room_id = :room_id;
    `;

    let getLastMessageDateSQL = `
        select date_format(m.sent_datetime, "%W, %b. %d") "date"
        from message m
        where m.message_id = :max_msg;
    `;

    let user_id_params = {
        user_id: postData.user_id
    }

    try {
        const chats = await database.query(getChatsSQL, user_id_params);

        for (let i = 0; i < chats[0].length; i++) {
            let room = chats[0][i];

            let room_id_params = {
                room_id: room.id,
                last_msg: room.last_msg
            }

            let latestMessage = await database.query(getLatestMessageIDSQL, room_id_params);
            room_id_params.max_msg = latestMessage[0][0].max_msg;

            let unreadMessages = await database.query(getUnreadMessagesSQL, room_id_params);

            let lastMessageDate = await database.query(getLastMessageDateSQL, room_id_params);

            room.max_msg = latestMessage[0][0].max_msg;
            room.unread = unreadMessages[0][0].unread;
            room.date = lastMessageDate[0][0].date;
        }

        console.log("Successfully retrieved chats");
        console.log(chats[0]);
        return chats[0];
    }
    catch(err) {
        console.log("Error getting chats");
        console.log(err);
        return false;
    }
}

async function getChat(postData) {
    let getChatSQL = `
        select m.message_id "m_id", m.text "message", date_format(m.sent_datetime, "%W, %b. %d") "date", datediff(now(), m.sent_datetime) "num_days_from_now", u.user_id "u_id", u.username "username"
        from message m
        left join room_user ru
        on m.room_user_id = ru.room_user_id
        left join user u
        on ru.user_id = u.user_id
        where ru.room_id = :room_id
        order by m.sent_datetime asc;
    `;

    let getEmojisSQL = `
        select e.name "name", e.emoji_unicode "icon", count(r.reaction_id) "count"
        from emoji e
        left join reaction r
        on e.emoji_id = r.emoji_id
        where r.message_id = :message_id
        group by e.emoji_id;
    `;

    let room_id_params = {
        room_id: postData.room_id
    }

    try {
        const messages = await database.query(getChatSQL, room_id_params);

        for (let i = 0; i < messages[0].length; i++) {
            let message = messages[0][i];

            let message_id_params = {
                message_id: message.m_id
            }

            let emojis = await database.query(getEmojisSQL, message_id_params);

            message.emojis = [];
            
            for (let j = 0; j < emojis[0].length; j++) {
                let emoji = emojis[0][j];
                message.emojis[j] = {count: emoji.count, icon: emoji.icon};
                console.log(emoji.count + " " + String.fromCharCode(emoji.icon) + " " + emoji.icon);
            }
        }

        console.log("Successfully retrieved messages for room " + postData.room_id);
        console.log(messages[0]);

        return messages[0];
        
    } catch (err) {
        console.log("Error retreiving messages for room " + postData.room_id);
        console.log(err);
        return false;
    }
}

async function getChatUsers(postData) {
    let getChatUsersSQL = `
        select u.user_id "id", u.username "name"
        from user u
        left join room_user ru
        on u.user_id = ru.user_id
        left join room r
        on ru.room_id = r.room_id
        where r.room_id = :room_id;
    `;

    let room_id_params = {
        room_id: postData.room_id
    }

    try {
        const users = await database.query(getChatUsersSQL, room_id_params);

        console.log("Successfully retrieved users for room " + postData.room_id);
        console.log(users[0]);
        return users[0];
    } catch(err) {
        console.log("Error getting users for room " + postData.room_id);
        console.log(err);
        return false;
    }
}

async function sendMessage(postData) {
    let getRoomUserIDSQL = `
        select room_user_id
        from room_user
        where room_id = :room_id
        and user_id = :user_id;
    `;

    let sendMessageSQL = `
        insert into message (text, sent_datetime, room_user_id)
        values (:text, now(), :room_user_id);
    `;

    let room_user_id_params = {
        room_id: postData.room_id,
        user_id: postData.user_id
    }

    console.log(room_user_id_params);

    try {
        const room_user_id = await database.query(getRoomUserIDSQL, room_user_id_params);

        console.log("Successfully retrieved room_user_id");
        console.log(room_user_id);

        let message_params = {
            text: postData.message,
            room_user_id: room_user_id[0][0].room_user_id
        }

        try {
            const results = await database.query(sendMessageSQL, message_params);

            console.log("Successfully sent message");
            console.log(results[0]);
            return true;
        }
        catch(err) {
            console.log("Error sending message");
            console.log(err);
            return false;
        }

    } catch (err) {
        console.log("Error getting room_user_id");
        console.log(err);
        return false;
    }
}

async function getLastestMessageID(postData) {
    let getLatestMessageIDSQL = `
        select max(m.message_id) "max_msg"
        from message m
        left join room_user ru
        on m.room_user_id = ru.room_user_id
        left join room r
        on ru.room_id = r.room_id
        where r.room_id = :room_id;
    `;

    let room_id_params = {
        room_id: postData.room_id
    }

    try {
        const latestMessage = await database.query(getLatestMessageIDSQL, room_id_params);

        console.log("Successfully retrieved latest message id");
        console.log(latestMessage[0]);
        return latestMessage[0];
    }
    catch(err) {
        console.log("Error getting latest message id");
        console.log(err);
        return false;
    }
}

async function updateLastRead(postData) {
    let updateLastReadSQL = `
        update room_user
        set last_message_read_id = :last_message_read_id
        where room_id = :room_id
        and user_id = :user_id;
    `;

    let max_msg = await getLastestMessageID(postData);

    let last_message_read_id_params = {
        last_message_read_id: max_msg[0].max_msg,
        room_id: postData.room_id,
        user_id: postData.user_id
    };

    try {
        const results = await database.query(updateLastReadSQL, last_message_read_id_params);

        console.log("Successfully updated last read");
        console.log(results[0]);
        return true;
    }
    catch(err) {
        console.log("Error updating last read");
        console.log(err);
        return false;
    }
}

async function addUserToChat(postData) {
    let addUserToChatSQL = `
        insert into room_user (room_id, user_id, last_message_read_id)
        values (:room_id, :user_id, :last_msg);
    `;

    let max_msg = await getLastestMessageID(postData);

    let room_user_params = {
        room_id: postData.room_id,
        user_id: postData.user_id,
        last_msg: max_msg[0].max_msg
    }

    try {
        const results = await database.query(addUserToChatSQL, room_user_params);

        console.log("Successfully added user to chat");
        console.log(results[0]);
        return true;
    }
    catch(err) {
        console.log("Error adding user to chat");
        console.log(err);
        return false;
    }
}

async function getMessage(postData) {
    let getMessageSQL = `
        select ru.room_id "r_id", m.message_id "m_id", m.text "message", m.sent_datetime "date", datediff(now(), m.sent_datetime) "num_days_from_now", u.user_id "u_id", u.username "username"
        from message m
        left join room_user ru
        on m.room_user_id = ru.room_user_id
        left join user u
        on ru.user_id = u.user_id
        where m.message_id = :message_id;
    `;

    let getEmojisSQL = `
        select e.emoji_id "id", e.name "name", e.emoji_unicode "icon", r.user_id "u_id"
        from emoji e
        left join reaction r
        on e.emoji_id = r.emoji_id
        where r.message_id = :message_id
        order by e.emoji_id asc;
    `;

    let getAllEmojisSQL = `
        select e.emoji_id "id", e.name "name", e.emoji_unicode "icon"
        from emoji e;
    `;

    let message_id_params = {
        message_id: postData.message_id
    }

    try {
        let message = await database.query(getMessageSQL, message_id_params);

        console.log(message);

        let message_emojis = await database.query(getEmojisSQL, message_id_params);
        let all_emojis = await database.query(getAllEmojisSQL);

        let emojis = []
        
        for (let j = 0; j < all_emojis[0].length; j++) {
            emojis[j] = {id: all_emojis[0][j].id, name: all_emojis[0][j].name, icon: all_emojis[0][j].icon, count: 0, users: [], checked: false};
        }

        for (let i = 0; i < message_emojis[0].length; i++) {
            let emoji = message_emojis[0][i];
            emojis[emoji.id - 1].count++;
            emojis[emoji.id - 1].users.push(emoji.u_id);
            if (emoji.u_id == postData.user_id) {
                emojis[emoji.id - 1].checked = true;
            }
        }

        message[0][0].emojis = emojis;

        console.log("Successfully retrieved message " + postData.message_id);
        console.log(message[0][0]);

        return message[0][0];
        
    } catch (err) {
        console.log("Error retreiving message " + postData.message_id);
        console.log(err);
        return false;
    }
}

async function toggleReaction(user_id, message_id, emoji_id) {
    let getReactionSQL = `
        select reaction_id
        from reaction
        where user_id = :user_id
        and message_id = :message_id
        and emoji_id = :emoji_id;
    `;

    let deleteReactionSQL = `
        delete from reaction
        where reaction_id = :reaction_id;
    `;

    let createReactionSQL = `
        insert into reaction (user_id, message_id, emoji_id)
        values (:user_id, :message_id, :emoji_id);
    `;

    let reaction_params = {
        user_id: user_id,
        message_id: message_id,
        emoji_id: emoji_id
    }

    try {
        const reaction = await database.query(getReactionSQL, reaction_params);

        if (reaction[0].length > 0) {
            reaction_params.reaction_id = reaction[0][0].reaction_id;
            const results = await database.query(deleteReactionSQL, reaction_params);
            console.log("Successfully deleted reaction");
            console.log(results[0]);
            return true;
        } else {
            const results = await database.query(createReactionSQL, reaction_params);
            console.log("Successfully created reaction");
            console.log(results[0]);
            return true;
        }
    }
    catch(err) {
        console.log("Error toggling reaction");
        console.log(err);
        return false;
    }
}

async function createRoom(name, users) {
    let createRoomSQL = `
        insert into room (name, start_datetime)
        values (:name, now());
    `;

    let getRoomIDSQL = `
        select room_id
        from room
        where name = :name;
    `;

    let create_room_params = {
        name: name
    };

    try {
        await database.query(createRoomSQL, create_room_params);
        const room_id = await database.query(getRoomIDSQL, create_room_params);

        console.log("Successfully created room");

        for (let i = 0; i < users.length; i++) {
            let user = users[i];
            let room_user_params = {
                room_id: room_id[0][0].room_id,
                user_id: user
            };
            await addUserToChat(room_user_params);

            console.log("Successfully added user " + user + " to room " + room_id[0][0].room_id);
        }

        return true;

    } catch(err) {
        console.log("Error creating room");
        console.log(err);
        return false;
    }
}

module.exports = {getAllChats, getChat, sendMessage, getMessage, toggleReaction, updateLastRead, getChatUsers, addUserToChat, createRoom};