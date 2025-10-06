CREATE DATABASE IF NOT EXISTS melodyquest
  CHARACTER SET utf16
  COLLATE utf16_general_ci;

USE melodyquest;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS tracks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  youtube_url VARCHAR(255) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL,
  youtube_video_id VARCHAR(16) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL,
  category_id BIGINT NOT NULL,
  title VARCHAR(255) CHARACTER SET utf16 COLLATE utf16_general_ci NULL,
  cover_image_url VARCHAR(255) CHARACTER SET utf16 COLLATE utf16_general_ci NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tracks_category_id (category_id),
  CONSTRAINT fk_tracks_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_tracks_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS track_answers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  track_id BIGINT NOT NULL,
  answer_text VARCHAR(255) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL,
  normalized VARBINARY(255) NOT NULL,
  CONSTRAINT uq_track_answers UNIQUE (track_id, normalized),
  CONSTRAINT fk_track_answers_track FOREIGN KEY (track_id) REFERENCES tracks(id),
  INDEX idx_track_answers_norm (normalized(191))
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS games (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  host_user_id BIGINT NOT NULL,
  status ENUM('LOBBY', 'RUNNING', 'ENDED') NOT NULL DEFAULT 'LOBBY',
  round_count INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  CONSTRAINT fk_games_host FOREIGN KEY (host_user_id) REFERENCES users(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS game_categories (
  game_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  PRIMARY KEY (game_id, category_id),
  CONSTRAINT fk_gc_game FOREIGN KEY (game_id) REFERENCES games(id),
  CONSTRAINT fk_gc_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS game_players (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_game_user (game_id, user_id),
  CONSTRAINT fk_gp_game FOREIGN KEY (game_id) REFERENCES games(id),
  CONSTRAINT fk_gp_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS rounds (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  round_number INT NOT NULL,
  track_id BIGINT NOT NULL,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  winner_user_id BIGINT NULL,
  reveal_video TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_game_round (game_id, round_number),
  CONSTRAINT fk_rounds_game FOREIGN KEY (game_id) REFERENCES games(id),
  CONSTRAINT fk_rounds_track FOREIGN KEY (track_id) REFERENCES tracks(id),
  CONSTRAINT fk_rounds_winner FOREIGN KEY (winner_user_id) REFERENCES users(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS guesses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  round_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  guess_text VARCHAR(255) CHARACTER SET utf16 COLLATE utf16_general_ci NOT NULL,
  normalized VARBINARY(255) NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guesses_round (round_id),
  INDEX idx_guesses_user (user_id),
  INDEX idx_guesses_norm (normalized(191)),
  CONSTRAINT fk_guesses_round FOREIGN KEY (round_id) REFERENCES rounds(id),
  CONSTRAINT fk_guesses_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

CREATE TABLE IF NOT EXISTS scores (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_score (game_id, user_id),
  CONSTRAINT fk_scores_game FOREIGN KEY (game_id) REFERENCES games(id),
  CONSTRAINT fk_scores_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf16 COLLATE = utf16_general_ci;

DROP FUNCTION IF EXISTS fn_normalize;
DELIMITER $$
CREATE FUNCTION fn_normalize(s TEXT CHARSET utf16) RETURNS VARBINARY(255)
  DETERMINISTIC
BEGIN
  SET s = LOWER(s);
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(s, 'à', 'a'), 'á', 'a'), 'â', 'a'), 'ä', 'a');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(s, 'é', 'e'), 'è', 'e'), 'ê', 'e'), 'ë', 'e');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(s, 'ì', 'i'), 'í', 'i'), 'î', 'i'), 'ï', 'i');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(s, 'ò', 'o'), 'ó', 'o'), 'ô', 'o'), 'ö', 'o');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(s, 'ù', 'u'), 'ú', 'u'), 'û', 'u'), 'ü', 'u');
  SET s = REPLACE(s, 'ç', 'c');
  SET s = REPLACE(s, 'ñ', 'n');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s, '.', ' '), ',', ' '), '!', ' '), '?', ' '), ':', ' '), ';', ' ');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s, '-', ' '), '_', ' '), '/', ' '), '\\', ' '), '\'', ' ');
  WHILE INSTR(s, '  ') > 0 DO
    SET s = REPLACE(s, '  ', ' ');
  END WHILE;
  SET s = TRIM(s);
  RETURN CAST(LEFT(s, 255) AS VARBINARY(255));
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_track_answers_bi;
DELIMITER $$
CREATE TRIGGER trg_track_answers_bi BEFORE INSERT ON track_answers
FOR EACH ROW
BEGIN
  SET NEW.normalized = fn_normalize(NEW.answer_text);
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_track_answers_bu;
DELIMITER $$
CREATE TRIGGER trg_track_answers_bu BEFORE UPDATE ON track_answers
FOR EACH ROW
BEGIN
  SET NEW.normalized = fn_normalize(NEW.answer_text);
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_guesses_bi;
DELIMITER $$
CREATE TRIGGER trg_guesses_bi BEFORE INSERT ON guesses
FOR EACH ROW
BEGIN
  SET NEW.normalized = fn_normalize(NEW.guess_text);
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_guesses_bu;
DELIMITER $$
CREATE TRIGGER trg_guesses_bu BEFORE UPDATE ON guesses
FOR EACH ROW
BEGIN
  SET NEW.normalized = fn_normalize(NEW.guess_text);
END$$
DELIMITER ;

-- Les champs “normalized” en VARBINARY permettent l'indexation stable malgré l'UTF-16.
-- Les longueurs d'index (191) assurent la compatibilité avec innodb_large_prefix off/on.
