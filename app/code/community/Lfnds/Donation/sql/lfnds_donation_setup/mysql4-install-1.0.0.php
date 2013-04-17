<?php

/**
 * elefunds Magento Module
 *
 * Copyright (c) 2012, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Installation Script for the magento module,
 * creates DB Tables and adds VirtualProduct for Donations
 *
 * @package    elefunds Magento Module
 * @subpackage sql
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>, Roland Luckenhuber <roland@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */

/**
 * Fixes for Magento 1.5
 *
 * @deprecated
 */

// Fix for not supported datetime in magento <= 1.5
// Once we're done, change $datetime in the Table definitions
// with Varien_Db_Ddl_Table::TYPE_DATETIME
// ATM we're falling back to varchar for magento <=     1.5
$class = new ReflectionClass('Varien_Db_Ddl_Table');
if ($class->hasConstant('TYPE_DATETIME')) {
    $datetime = Varien_Db_Ddl_Table::TYPE_DATETIME;
    $datetimeIdentifier = NULL;
} else {
    $datetime = Varien_Db_Ddl_Table::TYPE_VARCHAR;
    $datetimeIdentifier = 25;
}

/**
 * @var $installer Mage_Core_Model_Resource_Setup
 */
$installer = $this;

define('ELEFUNDS_VIRTUAL_PRODUCT_SKU', 'elefunds-donation');

/**
 * @var int
 */
$donationProduct = Mage::getModel('catalog/product')->getIdBySku(ELEFUNDS_VIRTUAL_PRODUCT_SKU);

/**
 * Adding donationProduct to catalog/product if not already created
 */
if (!$donationProduct) {
    Mage::app()->loadAreaPart(Mage_Core_Model_App_Area::AREA_GLOBAL, Mage_Core_Model_App_Area::PART_EVENTS);
    Mage::app()->setCurrentStore(Mage_Core_Model_App::ADMIN_STORE_ID);
    Mage::app()->setUpdateMode(FALSE);


    $websiteId = Mage::app()->getStore(TRUE)->getWebsiteId();
    // In case the module gets installed with a brand new installation
    // we assume a website id of 0
    if (is_null($websiteId)) {
        $websiteId = 0;
    }

    /** @var Mage_Catalog_Model_Product $donationProduct  */
    $donationProduct = Mage::getModel('catalog/product');
    $donationProduct->setSku(ELEFUNDS_VIRTUAL_PRODUCT_SKU)
            ->setAttributeSetId(Mage::getModel('catalog/product')->getResource()->getEntityType()->getDefaultAttributeSetId())
            ->setTypeId(Mage_Catalog_Model_Product_Type::TYPE_VIRTUAL)
            ->setName('elefunds Donation')
            ->setDescription('An item that is used when donations are added as items')
            ->setShortDescription('An item that is used when donations are added as items')
            ->setPrice(0.00)
            ->setVisibility(Mage_Catalog_Model_Product_Visibility::VISIBILITY_NOT_VISIBLE)
            ->setStatus(Mage_Catalog_Model_Product_Status::STATUS_ENABLED)
            ->setTaxClassId(0)
            ->setCreatedAt(strtotime('now'))
            ->setWebsiteIds(array($websiteId, 1))
            ->setStockData(array(
                'manage_stock' => 0,
                'use_config_manage_stock'=> 0,
                'is_in_stock' => 1
            ));

    try {
        $donationProduct->save();
    } catch (Exception $exception){
        Mage::logException($exception);
    }

    // This is separated, as we do not want the extension to break when images cannot be added.
    // ATM it does not look like we need product images, but in case the use case arises (e.g.
    // when some shop wants it on it's invoice: Here you go.
    /*
     try {
        $skinPath = Mage::getBaseDir('skin') . DS . 'frontend' . DS . 'base ' . DS . 'default' . DS . 'images' . DS . 'lfnds_donation' . DS;
        $fullImagePath = $skinPath . 'elefunds_item_main.png';
        $fullSmallImagePath  = $skinPath . 'elefunds_item_small.png';
        $fullThumbnailPath = $skinPath . 'elefunds_item_thumbnail.png';

        $donationProduct->addImageToMediaGallery ($fullImagePath, array ('image'), false, false);
        $donationProduct->addImageToMediaGallery ($fullSmallImagePath, array ('small_image'), false, false);
        $donationProduct->addImageToMediaGallery ($fullThumbnailPath, array ('thumbnail'), false, false);
        $donationProduct->save();
    } catch (Exception $exception) {
        var_dump($exception); exit;
        Mage::logException($exception);
    }
    */
}

/**
 * Creating table lfnds_donation_donation
 */
if (!$installer->tableExists('lfnds_donation_donation')) {
    $donationTable = $installer->getConnection()
        ->newTable($installer->getTable('lfnds_donation_donation'))
        ->addColumn('donation_id', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'unsigned' => TRUE,
            'identity' => TRUE,
            'nullable' => FALSE,
            'primary' => TRUE,
        ), 'Donation ID')
        ->addColumn('foreign_id', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
            'nullable' => FALSE,
        ), 'Store ID')
        ->addColumn('amount', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'nullable' => TRUE,
        ), 'Amount')
        ->addColumn('suggested_amount', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'nullable' => TRUE,
        ), 'Suggested Amount')
        ->addColumn('grand_total', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'nullable' => TRUE,
        ), 'Suggested Amount')
        ->addColumn('receiver_ids', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
            'nullable' => TRUE,
        ), 'Receiver Ids')
        ->addColumn('available_receiver_ids', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
            'nullable' => TRUE,
        ), 'Available Receiver Ids')
        ->addColumn('time', $datetime, $datetimeIdentifier, array(
            'nullable' => FALSE,
        ), 'Time')
        ->addColumn('donator_firstname', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
            'nullable' => TRUE,
        ), 'Donator Firstname')
        ->addColumn('donator_lastname', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
            'nullable' => TRUE,
        ), 'Donator Lastname')
        ->addColumn('donator_zip', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'nullable' => TRUE,
        ), 'Donator ZIP Code')
        ->addColumn('donator_city', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
            'nullable' => TRUE,
        ), 'Donator Citry')
        ->addColumn('donator_countrycode', Varien_Db_Ddl_Table::TYPE_VARCHAR, 2, array(
            'nullable' => TRUE,
        ), 'Donator Countrycode')
        ->addColumn('state', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'nullable' => FALSE,
        ), 'The donation state');

    $installer->getConnection()->createTable($donationTable);
}

/**
 * Creating Table lfnds_donation_receiver
 */
if (!$installer->tableExists('lfnds_donation_receiver')) {
    $receiverTable = $installer->getConnection()
        ->newTable($installer->getTable('lfnds_donation_receiver'))
        ->addColumn('internal_identifier', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'unsigned' => FALSE,
            'identity' => TRUE,
            'nullable' => FALSE,
            'primary' => TRUE,
        ), 'Internal Identifier for magento')
        ->addColumn('receiver_id', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
            'unsigned' => FALSE,
            'nullable' => FALSE,
        ), 'Receiver ID')
        ->addColumn('name', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
            'nullable' => TRUE,
        ), 'Receiver ID')
        ->addColumn('countrycode', Varien_Db_Ddl_Table::TYPE_VARCHAR, 5, array(
            'nullable' => TRUE,
        ), 'Country Code')
        ->addColumn('description', Varien_Db_Ddl_Table::TYPE_VARCHAR, 200, array(
            'nullable' => TRUE,
        ), 'Description')
        ->addColumn('image', Varien_Db_Ddl_Table::TYPE_LONGVARCHAR, NULL, array(
            'nullable' => TRUE,
        ), 'Image URL')
        ->addColumn('valid', $datetime, $datetimeIdentifier, array(
            'nullable' => FALSE,
        ), 'Valid');

    $installer->getConnection()->createTable($receiverTable);
}

/**
 * Post database fixes
 *
 * @deprecated
 */
$version = Mage::getVersionInfo();

// For 1.5 or lower
if ($version['major'] === '1' && in_array($version['minor'], array('4', '5'))) {
    $installer->getConnection()->query('ALTER TABLE lfnds_donation_receiver MODIFY internal_identifier INTEGER NOT NULL AUTO_INCREMENT');
    $installer->getConnection()->query('ALTER TABLE lfnds_donation_donation MODIFY donation_id INTEGER NOT NULL AUTO_INCREMENT');
}
