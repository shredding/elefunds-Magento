<?php

$installer = $this;
$installer->startSetup();
$installer->run("
    DROP TABLE IF EXISTS {$this->getTable('elefunds/receivers')};
    CREATE  TABLE {$this->getTable('elefunds/receivers')} (
      `id` INT NOT NULL AUTO_INCREMENT ,
      `receiver_id` INT NOT NULL ,
      `name` VARCHAR(45) NOT NULL ,
      `countrycode` VARCHAR(5) NULL ,
      `description` VARCHAR(200) NULL ,
      `image_url` TEXT NULL ,
      `valid` DATETIME NOT NULL ,
      PRIMARY KEY (`id`) )
    ENGINE = InnoDB
    DEFAULT CHARACTER SET = utf8;
");

$installer->endSetup();
