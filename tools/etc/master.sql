CREATE DATABASE IF NOT EXISTS isumaster DEFAULT CHARACTER SET 'utf8';

CREATE USER 'isumaster'@'%' IDENTIFIED BY 'isunagero';
GRANT ALL ON isumaster.* TO 'isumaster'@'%';
CREATE USER 'isumaster'@'localhost' IDENTIFIED BY 'isunagero';
GRANT ALL ON isumaster.* TO 'isumaster'@'localhost';

FLUSH PRIVILEGES;

CREATE TABLE IF NOT EXISTS isumaster.results (
  id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  teamid VARCHAR(32) NOT NULL,
  resulttime VARCHAR(14) NOT NULL, -- YYYYMMDDHHMMSS
  test TINYINT NOT NULL,
  score BIGINT DEFAULT 0,
  bench TEXT,
  checker TEXT,
  INDEX (teamid, resulttime DESC),
  INDEX (teamid, test, score DESC)
) ENGINE=InnoDB;
