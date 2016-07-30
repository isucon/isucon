CREATE DATABASE IF NOT EXISTS isucon DEFAULT CHARACTER SET 'utf8';

CREATE USER 'isuconapp'@'%' IDENTIFIED BY 'isunageruna';
GRANT ALL ON isucon.* TO 'isuconapp'@'%';
CREATE USER 'isuconapp'@'localhost' IDENTIFIED BY 'isunageruna';
GRANT ALL ON isucon.* TO 'isuconapp'@'localhost';

FLUSH PRIVILEGES;

CREATE TABLE IF NOT EXISTS isucon.article (
  id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(128) NOT NULL,
  body  VARCHAR(4096) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS isucon.comment (
  id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  article INT NOT NULL,
  name VARCHAR(64),
  body VARCHAR(1024) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (article, id DESC),
  -- SELECT article FROM comment GROUP BY article ORDER BY created_at DESC LIMIT 10;
  -- INDEX (created_at DESC, article)
  INDEX (article, created_at DESC)
) ENGINE=InnoDB;
