<?php

/**
 * elefunds Shopware Module
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

/**
 * @var string
 */
$virtualProductSku = 'donation';

/**
 * @var int
 */
$donationProduct = Mage::getModel('catalog/product')->getIdBySku($virtualProductSku);


/**
 * Adding donationProduct to catalog/product if not already created
 */
if (!$donationProduct) {
    Mage::app()->loadAreaPart(Mage_Core_Model_App_Area::AREA_GLOBAL, Mage_Core_Model_App_Area::PART_EVENTS);
    Mage::app()->setCurrentStore(Mage_Core_Model_App::ADMIN_STORE_ID);
    Mage::app()->setUpdateMode(false);

    $donationProduct = Mage::getModel('catalog/product')
            ->setSku($virtualProductSku)
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
    ->addColumn('status', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
        'nullable' => false,
    ), 'Status')
    ->addColumn('store_id', Varien_Db_Ddl_Table::TYPE_SMALLINT, null, array(
        'nullable' => false,
    ), 'Store ID')
    ->addColumn('amount', Varien_Db_Ddl_Table::TYPE_DECIMAL, null, array(
        'nullable' => true,
    ), 'Amount')
    ->addColumn('suggested_amount', Varien_Db_Ddl_Table::TYPE_DECIMAL, null, array(
        'nullable' => true,
    ), 'Suggested Amount')
    ->addColumn('order_id', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'nullable' => false,
    ), 'Order ID')
    ->addColumn('receivers', Varien_Db_Ddl_Table::TYPE_VARCHAR, 45, array(
        'nullable' => true,
    ), 'Receivers')
    ->addColumn('receipt', Varien_Db_Ddl_Table::TYPE_TINYINT, 1, array(
        'nullable' => false,
        'default' => 0,
    ), 'Receipt')
    ->addColumn('created_at', Varien_Db_Ddl_Table::TYPE_DATE, null, array(
        'nullable' => true,
    ), 'Created At')
    ->addColumn('updated_at', Varien_Db_Ddl_Table::TYPE_DATE, null, array(
        'nullable' => false,
    ), 'Updated At');

$installer->getConnection()->createTable($donationTable);


/**
 * Creating Table elefunds/receivers
 */
$receiverTable = $installer->getConnection()
    ->newTable($installer->getTable('elefunds/receivers'))
    ->addColumn('id', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
        'unsigned' => false,
        'identity' => true,
        'nullable' => false,
        'primary' => true,
    ), 'ID')
    ->addColumn('receiver_id', Varien_Db_Ddl_Table::TYPE_INTEGER, null, array(
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
    ->addColumn('image_url', Varien_Db_Ddl_Table::TYPE_LONGVARCHAR, null, array(
        'nullable' => true,
    ), 'Image URL')
    ->addColumn('valid', Varien_Db_Ddl_Table::TYPE_DATE, null, array(
        'nullable' => false,
    ), 'Valid');

$installer->getConnection()->createTable($receiverTable);