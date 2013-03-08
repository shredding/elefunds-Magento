<?php
/*
 * mysql4-upgrade-0.3.0-0.4.0.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */
 
 
$installer = $this;

$installer->startSetup();
// TODO: Discuss the behavior of this with the Elefunds team.
/*$elefundsAgreement = Mage::getModel('checkout/agreement');
$elefundsAgreement->setIsActive(1)
        ->setIsHtml(0)
        ->setCheckboxText($this->__('Text of checkbox'))
        ->setContent($this->__('Content of the Agreement'));
$elefundsAgreement->save();
*/

$installer->endSetup();
