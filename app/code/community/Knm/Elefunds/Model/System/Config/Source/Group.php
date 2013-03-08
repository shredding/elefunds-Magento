<?php
/*
 * Group.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */

class Knm_Elefunds_Model_System_Config_Source_Group
{
    protected $_options;
    
    
    public function toOptionArray($isMultiselect=false)
    {
        if (!$this->_options) {
            $options = Mage::getSingleton('payment/config')->getActiveMethods();
            foreach ($options as $code=>$value) {
                $optionsArray[] = array(
                   'value' => $code,
                   'label' => Mage::getStoreConfig('payment/'.$code.'/title'),
                );
            }         
            $this->_options=$optionsArray; 
        }

        $options = $this->_options;
        if(!$isMultiselect){
            array_unshift($options, array('value'=>'', 'label'=> Mage::helper('adminhtml')->__('--Please Select--')));
        }

        return $options;
    }
}

?>
