<?php

class Knm_Elefunds_Block_Adminhtml_Logs_Grid extends Mage_Adminhtml_Block_Widget_Grid
{
    public function __construct()
    {
        parent::__construct();
        $this->setId('ElefundsLogsGrid');
        $this->setDefaultSort('position');
        $this->setDefaultDir('ASC');
        $this->setSaveParametersInSession(true);
    }

    protected function _prepareCollection()
    {
        $collection = Mage::getModel('elefunds/elefunds')->getCollection();
        $this->setCollection($collection);
        return parent::_prepareCollection();
    }

    protected function _prepareColumns()
    {
        $this->addColumn('id', array(
            'header'    => Mage::helper('elefunds')->__('ID'),
            'align'     => 'center',
            'width'     => '50px',
            'index'     => 'id',
        ));

        $this->addColumn('request_type', array(
            'header'    => Mage::helper('elefunds')->__('Request Type'),
            'width'     => '30px',
            'index'     => 'request_type',
        ));

        $this->addColumn('request', array(
            'header'    => Mage::helper('elefunds')->__('Request'),
            'width'     => '150px',
            'index'     => 'request',
        ));

        $this->addColumn('response', array(
            'header'    => Mage::helper('elefunds')->__('Response'),
            'width'     => '150px',
            'index'     => 'response',
        ));

        $this->addColumn('created_at', array(
            'header'    => Mage::helper('elefunds')->__('Created at'),
            'align'     => 'center',
            'width'     => '60px',
            'index'     => 'created_at',
            'type'      => 'datetime',
        ));

        return parent::_prepareColumns();
    }
}