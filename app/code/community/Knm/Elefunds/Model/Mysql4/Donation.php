<?

/*
 * Donation.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */


class Knm_Elefunds_Model_Mysql4_Donation extends Mage_Core_Model_Mysql4_Abstract
{
    public function _construct()
    {
        $this->_init('elefunds/donation', 'donation_id');
    }
}
