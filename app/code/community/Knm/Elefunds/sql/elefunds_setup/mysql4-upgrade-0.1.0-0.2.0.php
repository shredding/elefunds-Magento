<?php

$installer = $this;
$installer->startSetup();
$installer->run("
    DROP TABLE IF EXISTS {$this->getTable('elefunds/logs')};
    CREATE TABLE {$this->getTable('elefunds/logs')} (
      `id` int unsigned auto_increment,
      `request_type` tinyint,
      `request` text,
      `response` text,
      `created_at` datetime NOT NULL default '0000-00-00 00:00:00',
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    
    DROP TABLE IF EXISTS {$this->getTable('elefunds/donation')};
    CREATE  TABLE {$this->getTable('elefunds/donation')} (
      `donation_id` INT unsigned NOT NULL AUTO_INCREMENT,
      `status` VARCHAR(45) NOT NULL ,
      `store_id` SMALLINT NOT NULL ,
      `amount` DECIMAL(12,4) NULL ,
      `suggested_amount` DECIMAL(12,4) NULL ,
      `order_id` INT NOT NULL ,
      `receivers` VARCHAR(45) NULL ,
      `receipt` tinyint(1) NOT NULL DEFAULT '0',
      `created_at` DATETIME NULL ,
      `updated_at` DATETIME NULL ,
      PRIMARY KEY (`donation_id`) )
    ENGINE = InnoDB
    DEFAULT CHARACTER SET = utf8
    COMMENT = 'Table to track, donation state. ';

");


$installer->endSetup();
