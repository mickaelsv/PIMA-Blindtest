//Import 
import mysql from 'mysql2';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { table } from 'console';
import { get } from 'http';

dotenv.config();

// create a connection to the database
const connection = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}).promise();

// connect to the database
connection.connect((err) => {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }

    console.log('connected as id ' + connection.threadId);
});

//functions 
export async function getUsers() {
    const [rows] = await connection.query("SELECT * FROM users");
    return rows;
}

export async function getUserById(id) {
    const [rows] = await connection.query("SELECT * FROM users WHERE user_id = ?", [id]);
    return rows[0];
}

export async function checkUser(username, password) {
    const [rows] = await connection.query("SELECT * FROM users WHERE username = ?", [username]);
    if (rows.length === 0) {
        return false;
    }
    if (bcrypt.compareSync(password, rows[0].password)) {
        return rows[0];
    }
    return false;
}

export async function checkAdmin(username) {
    const [rows] = await connection.query("SELECT is_admin FROM users WHERE username = ?", [username]);
    if (rows.length === 0) {
        return false;
    }
    return rows[0].is_admin;
}

export async function createUser(username, password) {
    try{
        const saltRounds = 10;
        const hash = bcrypt.hashSync(password, saltRounds);
        await connection.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash]);
    } catch(error){
         return false;
    }
    return true;
}

export async function getMusic() {
    const [rows] = await connection.query("SELECT * FROM music");
    return rows;
}
export async function getInfoMusic(music_id) {
    const [rows] = await connection.query("SELECT * FROM music WHERE music_id = ?", [music_id]);
    return rows;
}

export async function getMusicId(music_name, artist_name, origin, music_type) {
    const [rows] = await connection.query("SELECT music_id FROM music WHERE music_name = ? AND artist_name = ? AND origin = ? AND music_type = ?", [music_name, artist_name, origin, music_type]);
    return rows[0].music_id;
}

export async function getUserMusic() {
    const [rows] = await connection.query("SELECT music_name, artist_name, origin, music_type FROM music");
    return rows;
}

export async function addMusic(music_name, artist_name, origin, music_type) {
    await connection.query("INSERT INTO music (music_name, artist_name, origin, music_type) VALUES (?, ?, ?, ?)", [music_name, artist_name, origin, music_type]);
    return await connection.query("SELECT music_id FROM music WHERE music_name = ? AND artist_name = ? AND origin = ? AND music_type = ?", [music_name, artist_name, origin, music_type]);
}

export async function musicExists(music_name, artist_name, origin, music_type) {
    const [rows] = await connection.query("SELECT * FROM music WHERE music_name = ? AND artist_name = ? AND origin = ? AND music_type = ?", [music_name, artist_name, origin, music_type]);
    return rows.length > 0;
}

export async function deleteMusic(music_id) {
    await connection.query("DELETE FROM music WHERE music_id = ?", [music_id]);
}

export async function deleteUser(username) {
    await connection.query("DELETE FROM users WHERE username = ?", [username]);
}

export async function updateMusic(music_id, music_name, artist_name, origin, music_type) {
    await connection.query("UPDATE music SET music_name = ?, artist_name = ?, origin = ?, music_type = ? WHERE music_id = ?", [music_name, artist_name, origin, music_type, music_id]);
}

//Playlist


// Check if a song is already in a playlist
export async function isSongInPlaylist(music_id, user_id, playlistName) {
    try {
        const [[getterplaylist_id]] = await getPlaylistId(user_id,playlistName) // Get the playlist id
        const playlist_id = getterplaylist_id.playlist_id; //needed to get the playlist id
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name
        const [rows] = await connection.query(`SELECT * FROM ${tableName} WHERE music_id = ?`, [music_id]);
        return rows.length > 0;
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Check if a song is already in a playlist
export async function isSongInPlaylistID(music_id, user_id, playlist_id) {
    try {
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name
        const [rows] = await connection.query(`SELECT * FROM ${tableName} WHERE music_id = ?`, [music_id]);
        return rows.length > 0;
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Add a music to the playlist of a given user. If the user doesn't have a playlist, create one.
export async function addMusicToPlaylist(music_id, user_id, playlistName) {
    try {
        const [[getterplaylist_id]] = await getPlaylistId(user_id,playlistName) // Get the playlist id object
        const playlist_id = getterplaylist_id.playlist_id; //needed to get the playlist id
        const tableName = `playlist_${user_id}_${playlist_id}`; // syntax of the table name
        const isSongPlaylist = await isSongInPlaylist(music_id, user_id, playlistName); // Check if the song is already in the playlist
        if (!isSongPlaylist) {
        await connection.query(`INSERT INTO ${tableName} (music_id) VALUES (?)`, [music_id]); // Add the music to the playlist
        console.log('The music has been added to the playlist successfully.');
        }
        else {
            console.log('The music is already in the playlist.');
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
}
export async function addMusicToPlaylistID(user_id, playlist_id, music_id) {
    try {
        const tableName = `playlist_${user_id}_${playlist_id}`; // syntax of the table name
        const isSongPlaylist = await isSongInPlaylistID(music_id, user_id, playlist_id); // Check if the song is already in the playlist
        if (!isSongPlaylist) {
            //get the last order_to_play
            const [rows] = await connection.query(`SELECT order_to_play FROM ${tableName} ORDER BY order_to_play DESC LIMIT 1`);
            //order to play is the last order_to_play + 1 and 1 if the playlist is empty
            const order = rows.length > 0 ? rows[0].order_to_play+1 : 1;
            await connection.query(`INSERT INTO ${tableName} (music_id,order_to_play) VALUES (?,?)`, [music_id, order]); // Add the music to the playlist
            console.log('The music has been added to the playlist successfully.');
        }
        else {
            console.log('The music is already in the playlist.');
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

export async function updateOrderToPlay(user_id, playlist_id, music_id, order_to_play) {
    try {
        const tableName = `playlist_${user_id}_${playlist_id}`; // syntax of the table name
        await connection.query(`UPDATE ${tableName} SET order_to_play = ? WHERE music_id = ?`, [order_to_play, music_id]); // Add the music to the playlist
        console.log('The order to play has been updated successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Get the id of a playlist, given the user_id and the playlist name
export async function getPlaylistId(user_id, playlistName) {
    try {
        return await connection.query(`SELECT playlist_id FROM playlist_list WHERE user_id = ? AND playlist_name = ?`, [user_id, playlistName]);  
    } catch (error) {
        console.error('An error occurred:', error);
    }
}
// Remove a music from the playlist of a given user
export async function removeMusicFromPlaylist(music_id, user_id, playlistName) {
    try {
        const [[getterplaylist_id]] = await getPlaylistId(user_id,playlistName) // Get the playlist id
        const playlist_id = getterplaylist_id.playlist_id; //needed to get the playlist id
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name

        //update order of the other musics
        const [rows] = await connection.query(`SELECT order_to_play FROM ${tableName} WHERE music_id = ?`, [music_id]);
        const order = rows[0].order_to_play;
        await connection.query(`UPDATE ${tableName} SET order_to_play = order_to_play-1 WHERE order_to_play > ?`, [order]);

        await connection.query(`DELETE FROM ${tableName} WHERE music_id = ?`, [music_id]); // Remove the music from the playlist
        console.log('The music has been removed from the playlist successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}
export async function removeMusicFromPlaylistID(user_id, playlist_id, music_id) {
    try {
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name

        //update order of the other musics
        const [rows] = await connection.query(`SELECT order_to_play FROM ${tableName} WHERE music_id = ?`, [music_id]);
        const order = rows[0].order_to_play;
        await connection.query(`UPDATE ${tableName} SET order_to_play = order_to_play-1 WHERE order_to_play > ?`, [order]);

        await connection.query(`DELETE FROM ${tableName} WHERE music_id = ?`, [music_id]); // Remove the music from the playlist
        console.log('The music has been removed from the playlist successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Insert a playlist to the playlists table
export async function insertPlaylistToList(user_id, playlistName) {
    try {
        await connection.query(`INSERT INTO playlist_list (user_id, playlist_name) VALUES (?, ?)`, [user_id, playlistName]);
        console.log('The playlist has been added to the playlists table successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
}
}

// Create a playlist for a given user, and adds it to the playlist_list table
export async function createPlaylist(user_id, playlistName) {
    try {
        await insertPlaylistToList(user_id, playlistName);
        const [[getterplaylist_id]] = await getPlaylistId(user_id,playlistName) // Get the table name
        const playlist_id = getterplaylist_id.playlist_id;
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name
        await connection.query(`CREATE TABLE ${tableName} (music_id int NOT NULL, order_to_play int NOT NULL, FOREIGN KEY (music_id) REFERENCES music(music_id) ON DELETE CASCADE)`); // Create the playlist
        console.log('The playlist has been created successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}


// Remove a playlist
export async function removePlaylist(user_id,playlist_id) {
    try {
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name
        await connection.query(`DROP TABLE ${tableName}`); // Remove the playlist
        console.log('The playlist has been removed successfully.');
        await connection.query(`DELETE FROM playlist_list WHERE playlist_id = ?`, [playlist_id]);
        console.log('The playlist has been removed from the playlists table successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Get the playlists of a given user
export async function getPlaylists(user_id) {
    try {
        const [rows] = await connection.query(`SELECT * FROM playlist_list WHERE user_id = ?`, [user_id]);
        return rows;
    } catch (error) {
        console.error('An error occurred:', error);
    }
}


// Get every playlist
export async function getAllPlaylists() {
    try {
        const [rows] = await connection.query(`SELECT * FROM playlist_list`);
        return rows;
    }
    catch (error) {
        console.error('An error occurred:', error);
    }   
}


// Get the songs of a given playlist
export async function getSongsFromPlaylist(user_id, playlist_id) {
    try {
        const tableName = `playlist_${user_id}_${playlist_id}`; // Get the table name

        const [rows] = await connection.query(`SELECT music_name, p.music_id, order_to_play FROM ${tableName} p join music m on m.music_id=p.music_id order by order_to_play`);
        return rows;
    } catch (error) {
        console.error('An error occurred:', error);
    }
}


// Check if a playlist already exists for a given user
export async function playlistExists(user_id, playlistName) {
    try {
        const [rows] = await connection.query("SELECT * FROM playlist_list WHERE user_id = ? AND playlist_name = ?", [user_id, playlistName]);
        return rows.length > 0;
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
}

//Get the name of a playlist given the user_id and the playlist_id
export async function getPlaylistName(user_id, playlist_id) {
    try {
        const [rows] = await connection.query("SELECT playlist_name FROM playlist_list WHERE user_id = ? AND playlist_id = ?", [user_id, playlist_id]);
        return rows;
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
}

export async function addGamePlayed(user_id) {
    try {
        await connection.query("UPDATE users SET nb_games = nb_games + 1 WHERE user_id = ?", [user_id]);
        console.log('The number of games played has been updated successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

export async function addWin(user_id) {
    try {
        await connection.query("UPDATE users SET nb_win = nb_win + 1 WHERE user_id = ?", [user_id]);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

export async function updateAvgScore(user_id, score) {
    try {
        //get the number of games played
        const [rows] = await connection.query("SELECT nb_games FROM users WHERE user_id = ?", [user_id]);
        const nb_games = rows[0].nb_games;
        //calculate the new average score
        const [rows2] = await connection.query("SELECT avg_score FROM users WHERE user_id = ?", [user_id]);
        const avg_score = rows2[0].avg_score;
        //make score an integer
        score = parseInt(score);
        const new_avg_score = Math.floor((avg_score*(nb_games-1)+score)/nb_games);
        //update the average score
        await connection.query("UPDATE users SET avg_score = ? WHERE user_id = ?", [new_avg_score, user_id]);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}