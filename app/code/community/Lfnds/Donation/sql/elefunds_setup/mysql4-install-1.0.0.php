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
    Mage::app()->setUpdateMode(false);

    /** @var Mage_Catalog_Model_Product $donationProduct  */
    $donationProduct = Mage::getModel('catalog/product');
    $donationProduct->setSku(ELEFUNDS_VIRTUAL_PRODUCT_SKU)
            ->setAttributeSetId(4)
            ->setTypeId(Mage_Catalog_Model_Product_Type::TYPE_VIRTUAL)
            ->setName('elefunds Donation')
            ->setDescription('An item that is used when donations are added as items')
            ->setShortDescription('An item that is used when donations are added as items')
            ->setPrice(0.00)
            ->setVisibility(Mage_Catalog_Model_Product_Visibility::VISIBILITY_NOT_VISIBLE)
            ->setStatus(Mage_Catalog_Model_Product_Status::STATUS_ENABLED)
            ->setTaxClassId(0)
            ->setCreatedAt(strtotime('now'))
            ->setWebsiteIds(array(Mage::app()->getStore(true)->getWebsite()->getId(), 1))
            ->setStockData(array(
                'manage_stock' => 0,
                'use_config_manage_stock'=>0,
                'is_in_stock' => 1
            ));

    try {
        $donationProduct->save();
    } catch (exception $e){
        Mage::log("VirtualProduct-Item (Donation) not saved properly.", null, "elefunds.log");
    }
}

/**
 * Creating table elefunds/donation
 */
$donationTable = $installer->getConnection()
    ->newTable($installer->getTable('elefunds/donation'))
    ->addColumn('donation_id', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'unsigned' => true,
        'identity' => true,
        'nullable' => false,
        'primary' => true,
    ), 'Donation ID')
    ->addColumn('foreign_id', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
        'nullable' => false,
    ), 'Store ID')
    ->addColumn('amount', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'nullable' => true,
    ), 'Amount')
    ->addColumn('suggested_amount', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'nullable' => true,
    ), 'Suggested Amount')
    ->addColumn('grand_total', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'nullable' => true,
    ), 'Suggested Amount')
    ->addColumn('receiver_ids', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
        'nullable' => true,
    ), 'Receiver Ids')
    ->addColumn('available_receiver_ids', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
        'nullable' => true,
    ), 'Available Receiver Ids')
    ->addColumn('time', Varien_Db_Ddl_Table::TYPE_DATE, null, array(
        'nullable' => true,
    ), 'Time')
    ->addColumn('donator_firstname', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
        'nullable' => true,
    ), 'Donator Firstname')
    ->addColumn('donator_lastname', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
        'nullable' => true,
    ), 'Donator Lastname')
    ->addColumn('donator_zip', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'nullable' => true,
    ), 'Donator ZIP Code')
    ->addColumn('donator_city', Varien_Db_Ddl_Table::TYPE_VARCHAR, 255, array(
        'nullable' => true,
    ), 'Donator Citry')
    ->addColumn('donator_countrycode', Varien_Db_Ddl_Table::TYPE_VARCHAR, 2, array(
        'nullable' => true,
    ), 'Donator Countrycode')
    ->addColumn('state', Varien_Db_Ddl_Table::TYPE_INTEGER, NULL, array(
        'nullable' => false,
    ), 'The donation state');

$installer->getConnection()->createTable($donationTable);


/**
 * Creating Table elefunds/receiver
 */
$receiverTable = $installer->getConnection()
    ->newTable($installer->getTable('elefunds/receiver'))
    ->addColumn('internal_identifier', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'unsigned' => false,
        'identity' => true,
        'nullable' => false,
        'primary' => true,
    ), 'Internal Identifier for magento')
    ->addColumn('id', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'unsigned' => false,
        'nullable' => false,
    ), 'Receiver ID')
    ->addColumn('name', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
        'nullable' => true,
    ), 'Receiver ID')
    ->addColumn('countrycode', Varien_Db_Ddl_Table::TYPE_VARCHAR, 5, array(
        'nullable' => true,
    ), 'Country Code')
    ->addColumn('description', Varien_Db_Ddl_Table::TYPE_VARCHAR, 200, array(
        'nullable' => true,
    ), 'Description')
    ->addColumn('image', Varien_Db_Ddl_Table::TYPE_LONGVARCHAR, null, array(
        'nullable' => true,
    ), 'Image URL')
    ->addColumn('valid', Varien_Db_Ddl_Table::TYPE_DATE, null, array(
        'nullable' => false,
    ), 'Valid');

$installer->getConnection()->createTable($receiverTable);