<?php

class Knm_Elefunds_Block_Adminhtml_Logs extends Mage_Adminhtml_Block_Widget_Grid_Container {
    public function __construct() {
        parent::__construct();
        $this->_blockGroup = 'elefunds';
        $this->_controller = 'adminhtml_logs';
        $this->_headerText = Mage::helper('elefunds')->__('Elefunds Logs');
        $this->_removeButton('add');
    }
}