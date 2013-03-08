<?php
/*
 *      mysql4-install-0.1.0.php
 *
 *      Copyright 2012 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */


$installer = $this;

$virtualProductSku = 'donation';

$donationProduct = Mage::getModel('catalog/product')->getIdBySku($virtualProductSku);


if(!$donationProduct) {
    Mage::app()->loadAreaPart(Mage_Core_Model_App_Area::AREA_GLOBAL, Mage_Core_Model_App_Area::PART_EVENTS);
    Mage::app()->setCurrentStore(Mage_Core_Model_App::ADMIN_STORE_ID);
    Mage::app()->setUpdateMode(false);
    
    //TODO: Change hardcoded constants to class defined constants to ensure 
    //      shop compatibility. 

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
            ->setCreatedAt(strtotime('now'));

    $donationProduct->setWebsiteIds(array(Mage::app()->getStore(true)->getWebsite()->getId(), 1));
    $donationProduct->setStockData(array(
                'manage_stock' => 0, 
                'use_config_manage_stock'=>0,
                'is_in_stock' => 1
        ));
    try{
        $donationProduct->save();
    } catch(exception $e){
        Mage::log("Donation item not saved properly", null, "elefunds_log.txt");
    }
    //$itemStock = $donationProduct->getStockItem();
}
