// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

contract jsbToken
 { // 改成你的合约ming
    string public name = "jsbToken"; // 改成你的合约名
    string public symbol = "jsb202430552474"; // 改成你的姓名首字母+学号，如 ZS202412345678
    uint8 public decimals = 18;
    uint256 public totalSupply;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "jsbToken: caller is not the owner");
        _;
    }

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        owner = msg.sender;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address _owner, address spender) public view returns (uint256) {
        return _allowances[_owner][spender];
    }

    // TODO 1: 转账
    function transfer(address to, uint256 value) public returns (bool) {
        require(to != address(0), "jsbToken: transfer to zero address");
        require(_balances[msg.sender] >= value, "jsbToken: balance insufficient");
        
        _balances[msg.sender] -= value;
        _balances[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    // TODO 2: 授权
    function approve(address spender, uint256 value) public returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    // TODO 3: 代扣转账
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(_balances[from] >= value, "jsbToken: balance insufficient");
        require(_allowances[from][msg.sender] >= value, "jsbToken: allowance insufficient");
        
        _allowances[from][msg.sender] -= value;
        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    // TODO 4: 增发 (只有 owner 能调)
    function mint(address to, uint256 value) public onlyOwner {
        require(to != address(0), "jsbToken: mint to zero address");
        totalSupply += value;
        _balances[to] += value;
        emit Transfer(address(0), to, value);
    }

    // TODO 5: 销毁自己的代币
    function burn(uint256 value) public {
        require(_balances[msg.sender] >= value, "jsbToken: burn exceeds balance");
        _balances[msg.sender] -= value;
        totalSupply -= value;
        emit Transfer(msg.sender, address(0), value);
    }
}