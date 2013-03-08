<?
/*
 * Donation.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */


class Knm_Elefunds_Model_Donation extends Mage_Core_Model_Abstract
{
    protected $_eventPrefix = 'elefunds_donation';

    const STATE_NEW                     = 'new';
    const STATUS_SENT                   = 'sent';
    const STATUS_CANCELLED_CAPTURE      = 'cancelled-captured';
    const STATUS_CANCELLED_SENT         = 'cancelled-sent';
    
    
    protected function _construct()
    {
        $this->_init('elefunds/donation');
    }
    
    public function loadByAttribute($attribute, $value)
    {
        $this->load($value, $attribute);
        return $this;
    }    
}
