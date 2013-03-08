<?
/*
 * Donation.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */


class Knm_Elefunds_Model_Receivers extends Mage_Core_Model_Abstract
{
    protected $_eventPrefix = 'elefunds_receivers';

    protected function _construct()
    {
        $this->_init('elefunds/receivers');
    }

}
